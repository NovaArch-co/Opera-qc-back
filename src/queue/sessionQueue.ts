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

const prisma = new PrismaClient();
const BUCKET_NAME = "audio-files";

// Create a new queue
export const sessionQueue = new Queue('session-processing', {
    connection: {
        host: env.REDIS_HOST || 'localhost',
        port: parseInt(env.REDIS_PORT || '6379', 10),
    }
});

// Create a worker to process the queue
export const sessionWorker = new Worker('session-processing', async (job) => {
    const {
        level,
        time,
        pid,
        hostname,
        name,
        type,
        sourceChannel,
        sourceNumber,
        queue,
        destChannel,
        destNumber,
        date,
        duration,
        filename,
        msg
    } = job.data;

    try {
        const baseUrl = env.FILE_SERVER_BASE_URL;
        const fileName = filename.replace(".wav", "");

        const filePathIn = `${baseUrl}${fileName}-in`;
        const filePathOut = `${baseUrl}${fileName}-out`;

        const formattedDate = new Date(date.replace(" ", "T") + "Z");

        // Ensure audio_files directory exists
        const audioDir = path.join(__dirname, '../../api/session/audio_files');
        if (!fs.existsSync(audioDir)) {
            fs.mkdirSync(audioDir, { recursive: true });
        }

        const fileDestIn = path.join(audioDir, `${fileName}-in.wav`);
        const fileDestOut = path.join(audioDir, `${fileName}-out.wav`);

        // Download audio files
        await sendAudioRequests(filePathIn, "incoming", fileDestIn);
        await sendAudioRequests(filePathOut, "outgoing", fileDestOut);

        // Upload to MinIO
        const fileUrlIn = await uploadToMinIO(fileDestIn, `${fileName}-in.wav`);
        const fileUrlOut = await uploadToMinIO(fileDestOut, `${fileName}-out.wav`);

        if (!fileUrlIn || !fileUrlOut) {
            console.error("Failed to upload files to MinIO");
            return null;
        }

        // Get transcription
        const transcribeResponse = await sendFilesToTranscriptionAPI(fileDestIn, fileDestOut);
        if (!transcribeResponse) {
            console.error("Failed to get transcription");
            return null;
        }

        const parsedTranscription = TranscriptionResponseSchema.safeParse(transcribeResponse);
        if (!parsedTranscription.success) {
            console.error("Failed to parse transcription response");
            return null;
        }

        // Get analysis
        const analysisResponse = await sendToAnalysisAPI(transcribeResponse);
        if (!analysisResponse) {
            console.error("Failed to get analysis");
            return null;
        }

        const parsedAnalysis = AnalysisResponseSchema.safeParse(analysisResponse);
        if (!parsedAnalysis.success) {
            console.error("Failed to parse analysis response");
            return null;
        }

        const parsedTranscriptionData = parsedTranscription.data;
        const parsedAnalysisData = parsedAnalysis.data?.analysis;

        // Create session event
        const newSessionEvent = await prisma.sessionEvent.create({
            data: {
                level,
                time: String(time),
                pid,
                hostname,
                name,
                type,
                sourceChannel,
                sourceNumber,
                queue,
                destChannel,
                destNumber,
                date: formattedDate,
                duration,
                filename,
                msg,
                incommingfileUrl: fileUrlIn,
                outgoingfileUrl: fileUrlOut,
                transcription: parsedTranscriptionData,
                explanation: parsedAnalysisData?.explanation?.[0] || null,
                category: parsedAnalysisData?.category?.[0] || null,
                topic: parsedAnalysisData?.topic || {},
                emotion: parsedAnalysisData?.emotion?.[0] || null,
                keyWords: parsedAnalysisData?.key_words || [],
                routinCheckStart: parsedAnalysisData?.routin_check_start?.[0] || null,
                routinCheckEnd: parsedAnalysisData?.routin_check_end?.[0] || null,
                forbiddenWords: parsedAnalysisData?.forbidden_words ? parsedAnalysisData.forbidden_words : {},
            },
        });

        return newSessionEvent;
    } catch (error) {
        console.error("Error processing session:", error);
        return null;
    }
}, {
    connection: {
        host: env.REDIS_HOST || 'localhost',
        port: parseInt(env.REDIS_PORT || '6379', 10),
    }
}); 