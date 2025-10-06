import { Queue, Worker } from 'bullmq';
import { env } from '@/common/utils/envConfig';
import { PrismaClient } from '@prisma/client';
import { sendFilesToTranscriptionAPI } from '@/api/session/session';
import { TranscriptionResponseSchema } from '@/api/session/sessionModel';
import fs from 'fs';

const prisma = new PrismaClient();

// Create a dedicated transcription queue for ASR
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

// Create a new queue for LLM analysis
export const llmQueue = new Queue('llm-processing', {
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

// Transcription worker: only ASR, then enqueue LLM job
export const transcriptionWorker = new Worker(
    'transcription-processing',
    async (job: any) => {
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

            // Send files to ASR/transcription API only
            console.log("Sending files to ASR API...");
            const transcriptionResult = await sendFilesToTranscriptionAPI(customerFilePath, agentFilePath);
            console.log("ASR Result:", transcriptionResult);

            if (!transcriptionResult || typeof transcriptionResult.transcription !== "string" || !transcriptionResult.transcription) {
                console.error(`ASR API did not return a valid transcription for session ${sessionEventId}:`, transcriptionResult);
                // return {
                //     success: false,
                //     error: "ASR API did not return a valid transcription",
                //     sessionEventId
                // };
            }

            // if (!transcriptionResult) {
            //     console.error(`ASR failed for session ${sessionEventId}`);
            //     return {
            //         success: false,
            //         error: "ASR failed",
            //         sessionEventId
            //     };
            // }

            // Validate transcription result (optional, can be improved)
            const parsedProcess = TranscriptionResponseSchema.safeParse(transcriptionResult);
            if (!parsedProcess.success) {
                console.log(parsedProcess)
                console.error(`Invalid ASR Data for session ${sessionEventId}:`, parsedProcess.error.format());
                // return {
                //     success: false,
                //     error: "Invalid ASR data",
                //     sessionEventId
                // };
            }

            // Enqueue LLM job for analysis
            console.log("Adding to LLM Queue")
            await llmQueue.add('analyze-transcription', {
                sessionEventId,
                transcriptionResult,
                filename,
                customerFilePath,
                agentFilePath
            });

            // Clean up temporary files (optional: could be done in LLM worker after analysis)
            // (Commented out here, will be handled in LLM worker)

            return {
                success: true,
                sessionEventId,
                message: "ASR completed, LLM job enqueued"
            };

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
        concurrency: 6,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
);

// LLM worker: analysis step, concurrency 4
export const llmWorker = new Worker(
    'llm-processing',
    async (job: any) => {
        try {
            const { sessionEventId, transcriptionResult, filename, customerFilePath, agentFilePath } = job.data;
            // Import sendToAnalysisAPI lazily to avoid circular deps
            const { sendToAnalysisAPI } = await import('@/api/session/session');

            // Send transcription to LLM/analysis API
            const analysisResult = await sendToAnalysisAPI(transcriptionResult);

            // Compose data for DB update
            const analysisData = analysisResult?.analysis || {};
            const transcriptionData = analysisResult?.transcription || transcriptionResult?.transcription || null;

            // Update the session event with the analysis results
            await prisma.sessionEvent.update({
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

            // Clean up temporary files
            try {
                if (customerFilePath && fs.existsSync(customerFilePath)) {
                    fs.unlinkSync(customerFilePath);
                }
                if (agentFilePath && fs.existsSync(agentFilePath)) {
                    fs.unlinkSync(agentFilePath);
                }
                console.log(`Cleaned up temporary files for session ${sessionEventId}`);
            } catch (cleanupError) {
                console.warn(`Failed to cleanup files for session ${sessionEventId}:`, cleanupError);
            }

            return {
                success: true,
                sessionEventId,
                message: "LLM analysis completed successfully"
            };
        } catch (error) {
            console.error(`Error processing LLM job ${job.id}:`, error);
            throw error;
        }
    },
    {
        connection: {
            host: env.REDIS_HOST || 'localhost',
            port: env.REDIS_PORT,
        },
        concurrency: 4,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
);

// Set up event handlers for both workers
transcriptionWorker.on('completed', (job: any) => {
    console.log(`Transcription job ${job.id} completed successfully`);
});

transcriptionWorker.on('failed', (job: any, error: any) => {
    if (job) {
        console.error(`Transcription job ${job.id} failed:`, error);
    } else {
        console.error('A transcription job failed with error:', error);
    }
});

llmWorker.on('completed', (job: any) => {
    console.log(`LLM job ${job.id} completed successfully`);
});

llmWorker.on('failed', (job: any, error: any) => {
    if (job) {
        console.error(`LLM job ${job.id} failed:`, error);
    } else {
        console.error('A LLM job failed with error:', error);
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
