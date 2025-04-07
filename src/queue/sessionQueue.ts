import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { sendAudioRequests } from '@/api/session/session';
import { uploadToMinIO } from '@/api/session/session';
import { sendFilesToTranscriptionAPI } from '@/api/session/session';
import { sendToAnalysisAPI } from '@/api/session/session';
import { TranscriptionResponseSchema, AnalysisResponseSchema } from '@/api/session/sessionModel';
import path from 'node:path';
import { env } from '@/common/utils/envConfig';
import fs from 'fs';
import { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import os from 'os';

const prisma = new PrismaClient();
const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: env.MINIO_ENDPOINT_UTL,
    credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY || "minioaccesskey",
        secretAccessKey: env.MINIO_SECRET_KEY || "miniosecretkey",
    },
    forcePathStyle: true,
    tls: false,
});
const BUCKET_NAME = "audio-files";

// Function to ensure bucket exists
async function ensureBucketExists(bucketName: string) {
    try {
        // Check if bucket exists
        try {
            await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
            console.log(`Bucket ${bucketName} already exists`);
            return true;
        } catch (error) {
            // If we get here, bucket doesn't exist
            console.log(`Bucket ${bucketName} does not exist, creating now...`);
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
            console.log(`Created bucket: ${bucketName}`);
            return true;
        }
    } catch (error) {
        console.error(`Error ensuring bucket exists: ${error}`);
        return false;
    }
}

// Create a new queue
export const sessionQueue = new Queue('session-processing', {
    connection: {
        host: env.REDIS_HOST || 'localhost',
        port: String(parseInt(env.REDIS_PORT || '6379', 10)),
    }
});

// Create a worker to process the queue
export const sessionWorker = new Worker(
    env.BULL_QUEUE,
    async (job) => {
        try {
            // Get the data in the format it comes from the external service
            const {
                type,
                sourceChannel,
                sourceNumber,
                queue,
                destChannel,
                destNumber,
                date,
                duration,
                filename
            } = job.data;

            console.log("Received job data:", job.data);

            // Handle cases where fields might be undefined
            const sourceChannelValue = sourceChannel || "";
            const sourceNumberValue = sourceNumber || "";
            const destChannelValue = destChannel || "";
            const destNumberValue = destNumber || "";
            const queueValue = queue || "";

            // Basic auth credentials for file server
            const auth = {
                username: "FaraErtebat",
                password: "Goz@r!AsreFar@Erteb@t!1403"
            };

            // Download audio file from file server
            const fileUrl = `${env.FILE_SERVER_BASE_URL}${filename}`;
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                auth: auth
            });
            const audioBuffer = Buffer.from(response.data);

            // Ensure bucket exists before uploading
            await ensureBucketExists(BUCKET_NAME);

            // Upload to MinIO
            const key = `${filename}.wav`;
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Body: audioBuffer,
                    ContentType: 'audio/wav'
                })
            );

            // Create temporary files for transcription
            const tempDir = path.join(os.tmpdir(), 'opera-qc');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const tempFilePath = path.join(tempDir, `${filename}.wav`);
            fs.writeFileSync(tempFilePath, audioBuffer);

            // We need two files for transcription (customer and agent)
            // For now, we'll use the same file for both to demonstrate the flow
            const customerFilePath = tempFilePath;
            const agentFilePath = tempFilePath;

            // Map the snake_case fields to camelCase fields for Prisma
            const sessionEvent = await prisma.sessionEvent.create({
                data: {
                    level: 30, // Default log level (info)
                    time: new Date().toISOString(),
                    pid: process.pid,
                    hostname: os.hostname(),
                    name: "SESSION_EVENT",
                    msg: `Call recorded: ${filename}`,
                    type,
                    sourceChannel: sourceChannelValue,
                    sourceNumber: sourceNumberValue,
                    queue: queueValue,
                    destChannel: destChannelValue,
                    destNumber: destNumberValue,
                    date: new Date(date),
                    duration,
                    filename
                }
            });

            console.log("Created session event:", sessionEvent);

            try {
                // Step 3: Send files to transcription API
                console.log("Sending files to transcription API...");
                const transcriptionResult = await sendFilesToTranscriptionAPI(customerFilePath, agentFilePath);

                if (transcriptionResult) {
                    console.log("Transcription complete, sending for analysis...");

                    // Step 4: Send transcription to analysis API
                    const analysisResult = await sendToAnalysisAPI(transcriptionResult);

                    if (analysisResult) {
                        console.log("Analysis complete");

                        // Parse and validate the transcription and analysis results
                        const parsedTranscription = TranscriptionResponseSchema.safeParse(transcriptionResult);
                        if (!parsedTranscription.success) {
                            console.error("Invalid Transcription Data:", parsedTranscription.error.format());
                        } else {
                            console.log("✅ Valid Transcription Data:", parsedTranscription);
                        }

                        const parsedAnalysis = AnalysisResponseSchema.safeParse(analysisResult);
                        if (!parsedAnalysis.success) {
                            console.error("Invalid Analysis Data:", parsedAnalysis.error.format());
                        } else {
                            console.log("✅ Valid Analysis Data:", parsedAnalysis.data);
                        }

                        // Extract the data if validation was successful
                        const parsedTranscriptionData = parsedTranscription.success ? parsedTranscription.data : null;
                        const parsedAnalysisData = parsedAnalysis.success ? parsedAnalysis.data?.analysis : null;

                        if (parsedTranscriptionData && parsedAnalysisData) {
                            // Update the session event with the analysis results
                            const updatedSessionEvent = await prisma.sessionEvent.update({
                                where: { id: sessionEvent.id },
                                data: {
                                    incommingfileUrl: `/${BUCKET_NAME}/${filename}-in.wav`,
                                    outgoingfileUrl: `/${BUCKET_NAME}/${filename}-out.wav`,
                                    transcription: parsedTranscriptionData,
                                    explanation: parsedAnalysisData.explanation?.[0] || null,
                                    category: parsedAnalysisData.category?.[0] || null,
                                    topic: parsedAnalysisData.topic || null,
                                    emotion: parsedAnalysisData.emotion?.[0] || null,
                                    keyWords: parsedAnalysisData.key_words || [],
                                    routinCheckStart: parsedAnalysisData.routin_check_start?.[0] || null,
                                    routinCheckEnd: parsedAnalysisData.routin_check_end?.[0] || null,
                                    forbiddenWords: parsedAnalysisData.forbidden_words ? parsedAnalysisData.forbidden_words : {},
                                }
                            });

                            console.log("Updated session event with analysis results:", updatedSessionEvent.id);
                        }
                    }
                }
            } catch (processingError) {
                console.error("Error in post-processing:", processingError);
                // Continue execution - we don't want to fail the job if just the analysis fails
            }

            // Clean up temp files
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                console.error("Error cleaning up temp files:", cleanupError);
            }

            return {
                success: true,
                sessionEventId: sessionEvent.id
            };
        } catch (error) {
            console.error('Error processing session:', error);
            throw error;
        }
    },
    {
        connection: {
            host: env.REDIS_HOST,
            port: String(parseInt(env.REDIS_PORT, 10)),
        },
        concurrency: 5,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
); 