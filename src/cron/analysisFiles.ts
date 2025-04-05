import { Job, Worker } from "bullmq";
import { env } from "@/common/utils/envConfig";
import { redisConfig } from "@/cron/redis";
import {
    AnalysisResponseSchema,
    CreateSessionEventSchema,
    TranscriptionResponseSchema
} from "@/api/event/eventModel";
import path from "node:path";
import fs from "node:fs";
import { downloadAndSaveAudio } from "@/common/utils/downloadFileStream";
import FormData from "form-data";
import axios from "axios";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: "http://127.0.0.1:9000",
    credentials: {
        accessKeyId: "minioaccesskey",
        secretAccessKey: "miniosecretkey",
    },
    forcePathStyle: true,
});

const BUCKET_NAME = "audio-files";

export function addAnalyseCalls() {
    console.log("add worker")
    const worker = new Worker(
        env.BULL_QUEUE,
        async (job: Job) => {
            const data = job.data.message;
            const parsedData = CreateSessionEventSchema.safeParse(data);

            if (!parsedData.success) {
                console.error("FAILED TO PROCESS RECEIVED DATA:",);
                console.error("FAILED TO PROCESS RECEIVED DATA:", data);
            }

            try {
                await processCall(data)
            } catch (err) {
                await job.moveToFailed(err as Error, job.token as string);
            }

            return job.data;
        },
        {
            connection: redisConfig,
            concurrency: 1,
            lockDuration: 5000,
        }
    );
}


async function processCall(data): Promise<boolean> {
    try {
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
        } = data;

        const formattedDate = new Date(date.replace(" ", "T") + "Z"); // Converts "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"

        const baseUrl = env.FILE_SERVER_BASE_URL;
        const fileName = filename.replace(".wav", "");

        const filePathIn = path.join(__dirname, `./audio_files/${fileName}-in.wav`);
        const filePathOut = path.join(__dirname, `./audio_files/${fileName}-out.wav`);
        // if (type === "incoming") {
        // await sendAudioRequests(fullFileName + "-in", "incoming", filePathIn);
        // await sendAudioRequests(fullFileName + "-out", "outgoing", filePathOut);

        const fileUrlIn = await uploadToMinIO(filePathIn, `${fileName}-in.wav`);
        const fileUrlOut = await uploadToMinIO(filePathIn, `${fileName}-out.wav`);

        if (!fileUrlIn) {
            return false
        }

        const transcribeResponse = await sendFilesToTranscriptionAPI(filePathIn, filePathOut);

        const parsedTranscription = TranscriptionResponseSchema.safeParse(transcribeResponse);
        if (!parsedTranscription.success) {
            console.log("Invalid Transcription Data:", parsedTranscription.error.format());
            return false
        } else {
            // console.log("✅ Valid Transcription Data:", parsedTranscription);
        }

        const analysisResponse = await sendToAnalysisAPI(transcribeResponse);

        const parsedAnalysis = AnalysisResponseSchema.safeParse(analysisResponse);
        if (!parsedAnalysis.success) {
            console.log("Invalid Analysis Data:", parsedAnalysis.error.format());
            return false
        } else {
            // console.log("✅ Valid Analysis Data:", parsedAnalysis.data);
        }

        const parsedTranscriptionData = parsedTranscription.data
        const parsedAnalysisData = parsedAnalysis.data?.analysis


        if (fileUrlIn === "" || fileUrlOut === "") {
            console.log("FAILED CONDITION: fileUrlIn === \"\" || fileUrlOut === \"\"");
            return false
        }

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
                explanation: data.explanation?.[0] || null,
                category: data.category?.[0] || null,
                topic: data.topic || null,
                emotion: data.emotion?.[0] || null,
                keyWords: data.key_words || [],
                routinCheckStart: data.routin_check_start?.[0] || null,
                routinCheckEnd: data.routin_check_end?.[0] || null,
                forbiddenWords: data.forbidden_words ? data.forbidden_words : {},
            },
        });
    } catch (err) {
        console.log(err);
        return false
    }
}


const sendAudioRequests = async (fileName: string, type: "incoming" | "outgoing", filePath: string) => {
    const username = "FaraErtebat";
    const password = "Goz@r!AsreFar@Erteb@t!1403";
    const auth = {
        username,
        password,
    };


    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await downloadAndSaveAudio(`${fileName}`, filePath, auth);


    } catch (error) {
        console.error("Error sending audio requests:", error);
        // throw new Error("Failed to send and save audio streams.");
    }
};

const sendFilesToTranscriptionAPI = async (filePathIn: string, filePathOut: string) => {
    try {
        const form = new FormData();

        // Get file stats (size) to help FormData handle streams
        const fileStatIn = fs.statSync(filePathIn);
        const fileStatOut = fs.statSync(filePathOut);

        form.append("customer", fs.createReadStream(filePathIn));

        form.append("agent", fs.createReadStream(filePathOut));

        const response = await axios.post("http://79.127.12.135:8000/transcribe/", form, {
            headers: {
                ...form.getHeaders(), // Properly sets multipart headers
            },
        });

        return response.data; // Return the JSON response

    } catch (error) {
        console.error("Error sending files to transcription API:", error.response?.data || error.message);
        // throw new Error("Failed to send files for transcription.");
    }
};


const uploadToMinIO = async (filePath: string, objectName: string) => {
    try {
        const fileStream = fs.createReadStream(filePath);
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectName,
            Body: fileStream,
            ContentType: "audio/wav",
        });

        await s3Client.send(command);

        // Return MinIO URL
        return `/${BUCKET_NAME}/${objectName}`;
    } catch (error) {
        console.error("Error uploading to MinIO:", error);
    }
};

const sendToAnalysisAPI = async (transcriptionData: any) => {
    try {
        const response = await axios.post("http://79.127.12.135:8000/analyze/", transcriptionData, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        });

        return response.data; // Return the analysis response

    } catch (error) {
        console.error("Error sending transcription to analysis API:", error.response?.data || error.message);
        // throw new Error("Failed to send transcription for analysis.");
    }
};