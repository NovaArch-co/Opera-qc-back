import { Queue, Worker } from 'bullmq';
import { env } from '@/common/utils/envConfig';
import { PrismaClient } from '@prisma/client';
import { sendFilesToTranscriptionAPI, sendToAnalysisAPI } from '@/api/session/session';
import { TranscriptionResponseSchema } from '@/api/session/sessionModel';
import fs from 'fs';

const prisma = new PrismaClient();

// Create a dedicated transcription queue for slow processing
export const transcriptionQueue = new Queue('transcription-processing', {
    connection: {
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT,
    },
    defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    }
});

// Create a worker for transcription processing with higher concurrency
export const transcriptionWorker = new Worker(
    'transcription-processing',
    async (job) => {
        try {
            console.log(`Starting transcription job ${job.id} for session ${job.data.sessionEventId}`);

            const { sessionEventId, customerFilePath, agentFilePath, filename } = job.data;

            // Check if files exist
            if (!fs.existsSync(customerFilePath) || !fs.existsSync(agentFilePath)) {
                console.error(`One or both files not found for session ${sessionEventId}: ${customerFilePath}, ${agentFilePath}`);
                return {
                    success: false,
                    error: "Audio files not found",
                    sessionEventId
                };
            }

            console.log(`Analyzing audio files for session ${sessionEventId}`);

            // Send files to the combined process API endpoint that handles both transcription and analysis
            console.log("Sending files to process API...");
            const processResult = await sendFilesToTranscriptionAPI(customerFilePath, agentFilePath);
            console.log("Process Result:", processResult);

            if (!processResult) {
                console.error(`Audio processing failed for session ${sessionEventId}`);
                return {
                    success: false,
                    error: "Audio processing failed",
                    sessionEventId
                };
            }

            // The sendToAnalysisAPI now just returns the same processResult since analysis is included
            const analysisResult = await sendToAnalysisAPI(processResult);

            // Parse and validate the process result against our schema
            const parsedProcess = TranscriptionResponseSchema.safeParse(processResult);
            if (!parsedProcess.success) {
                console.error(`Invalid Process Data for session ${sessionEventId}:`, parsedProcess.error.format());
                return {
                    success: false,
                    error: "Invalid process data",
                    sessionEventId
                };
            }

            // Now update the session event with the process results
            try {
                const transcriptionData = processResult.transcription;
                const analysisData = processResult.analysis || {};

                // Update the session event with the data from the process API
                const updatedSessionEvent = await prisma.sessionEvent.update({
                    where: { id: sessionEventId },
                    data: {
                        transcription: transcriptionData,
                        explanation: analysisData.explanation?.[0] || null,
                        category: analysisData.category?.[0] || null,
                        topic: analysisData.topic || null,
                        emotion: analysisData.emotion?.[0] || null,
                        keyWords: analysisData.keywords || [],
                        routinCheckStart: analysisData.routinCheckStart || null,
                        routinCheckEnd: analysisData.routinCheckEnd || null,
                        forbiddenWords: analysisData.forbiddenWords || null,
                    }
                });

                console.log(`Updated session event with process results: ${sessionEventId}`);

                // Clean up temporary files
                try {
                    if (fs.existsSync(customerFilePath)) {
                        fs.unlinkSync(customerFilePath);
                    }
                    if (fs.existsSync(agentFilePath)) {
                        fs.unlinkSync(agentFilePath);
                    }
                    console.log(`Cleaned up temporary files for session ${sessionEventId}`);
                } catch (cleanupError) {
                    console.warn(`Failed to cleanup files for session ${sessionEventId}:`, cleanupError);
                }

                return {
                    success: true,
                    sessionEventId,
                    message: "Audio analysis completed successfully"
                };

            } catch (updateError) {
                console.error(`Failed to update session event ${sessionEventId}:`, updateError);
                return {
                    success: false,
                    error: "Failed to update session event",
                    sessionEventId
                };
            }

        } catch (error) {
            console.error(`Error processing transcription job ${job.id}:`, error);
            throw error;
        }
    },
    {
        connection: {
            host: env.REDIS_HOST || 'localhost',
            port: env.REDIS_PORT,
        },
        // GPU-safe concurrency - prevent VRAM exhaustion
        concurrency: 2,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
);

// Set up event handlers
transcriptionWorker.on('completed', (job) => {
    console.log(`Transcription job ${job.id} completed successfully`);
});

transcriptionWorker.on('failed', (job, error) => {
    if (job) {
        console.error(`Transcription job ${job.id} failed:`, error);
    } else {
        console.error('A transcription job failed with error:', error);
    }
});

// Helper function to add a transcription job
export async function addTranscriptionJob(sessionEventId: number, customerFilePath: string, agentFilePath: string, filename: string, options = {}) {
    console.log(`Queuing transcription job for session ${sessionEventId}`);

    return await transcriptionQueue.add('transcribe-audio', {
        sessionEventId,
        customerFilePath,
        agentFilePath,
        filename
    }, options);
}
