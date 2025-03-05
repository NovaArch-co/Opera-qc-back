import type {Request, RequestHandler, Response} from "express";
import {ServiceResponse} from "@/common/models/serviceResponse";
import {handleServiceResponse} from "@/common/utils/httpHandlers";
import {PrismaClient} from "@prisma/client";
import {StatusCodes} from "http-status-codes";
import {
    AnalysisResponseSchema,
    CreateSessionEventSchema,
    TranscriptionResponseSchema
} from "@/api/session/sessionModel";
import fs from "node:fs";
import path from "node:path";
import {downloadAndSaveAudio} from "@/common/utils/downloadFileStream";
import {env} from "@/common/utils/envConfig";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import axios from "axios";
import FormData from "form-data"; // ✅ Make sure you are using `form-data` package

const prisma = new PrismaClient();

const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: "http://minio:9000",
    credentials: {
        accessKeyId: "minioaccesskey",
        secretAccessKey: "miniosecretkey",
    },
    forcePathStyle: true,
});

const BUCKET_NAME = "audio-files";

class SessionEventController {
    public createSessionEvent: RequestHandler = async (req: Request, res: Response) => {
        try {
            const parsedData = CreateSessionEventSchema.safeParse(req.body);

            if (!parsedData.success) {
                return handleServiceResponse(
                    ServiceResponse.failure("Invalid input data", parsedData.error.errors, StatusCodes.BAD_REQUEST),
                    res
                );
            }


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
            } = parsedData.data;

            console.log("sessionEventController.parsedData.data;", parsedData.data);

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

            console.log("INCOMING", fileUrlIn);
            console.log("OUTGOING", fileUrlOut);

            const transcribeResponse = await sendFilesToTranscriptionAPI(filePathIn, filePathOut);

            const parsedTranscription = TranscriptionResponseSchema.safeParse(transcribeResponse);
            if (!parsedTranscription.success) {
                console.error("Invalid Transcription Data:", parsedTranscription.error.format());
            } else {
                console.log("✅ Valid Transcription Data:", parsedTranscription);
            }

            const analysisResponse = await sendToAnalysisAPI(transcribeResponse);

            const parsedAnalysis = AnalysisResponseSchema.safeParse(analysisResponse.analysis);
            if (!parsedAnalysis.success) {
                console.error("Invalid Analysis Data:", parsedAnalysis.error.format());
            } else {
                console.log("✅ Valid Analysis Data:", parsedAnalysis.data);
            }

            const parsedTranscriptionData = parsedTranscription.data
            const parsedAnalysisData = parsedAnalysis.data

            if (fileUrlIn === "" || fileUrlOut === "") {
                return handleServiceResponse(
                    ServiceResponse.failure("Error creating url in or out session event", null, StatusCodes.INTERNAL_SERVER_ERROR),
                    res
                );
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
                    explanation: parsedAnalysisData.explanation?.[0] || null,
                    category: parsedAnalysisData.category?.[0] || null,
                    topic: parsedAnalysisData.topic || null,
                    emotion: parsedAnalysisData.emotion?.[0] || null,
                    keyWords: parsedAnalysisData.key_words || [],
                    routinCheckStart: parsedAnalysisData.routin_check_start?.[0] || null,
                    routinCheckEnd: parsedAnalysisData.routin_check_end?.[0] || null,
                    forbiddenWords: parsedAnalysisData.forbidden_words || [],

                },
            });


            const serviceResponse = ServiceResponse.success("Session event created successfully", newSessionEvent);
            return handleServiceResponse(serviceResponse, res);

        } catch (error) {
            console.error(error);
            return handleServiceResponse(
                ServiceResponse.failure("Error creating session event", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    public getSessionEventById: RequestHandler = async (req: Request, res: Response) => {
        const {id} = req.params;

        try {
            const sessionEvent = await prisma.sessionEvent.findUnique({
                where: {id: Number(id)},
            });

            if (!sessionEvent) {
                return handleServiceResponse(ServiceResponse.failure("Session event not found", {}, StatusCodes.NOT_FOUND), res);
            }

            const serviceResponse = ServiceResponse.success("Session event retrieved successfully", sessionEvent);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.log(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session event", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getSessions: RequestHandler = async (req: Request, res: Response) => {
        try {
            const sessionEvent = await prisma.sessionEvent.findMany({});

            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", sessionEvent);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.log(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session event", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getSessionsByFilter: RequestHandler = async (req: Request, res: Response) => {
        try {
            const result = await prisma.$queryRaw`
            WITH filtered_data AS (
                SELECT * FROM "SessionEvent"
            )
            , topic_distribution AS (
                SELECT 
                    jsonb_object_keys(topic) AS topic_name,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY topic_name
            )
            , topic_trend AS (
                SELECT 
                    jsonb_object_keys(topic) AS topic_name,
                    DATE(date) AS call_date,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY topic_name, call_date
            )
            , emotion_distribution AS (
                SELECT 
                    emotion,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY emotion
            )
            , emotion_trend AS (
                SELECT 
                    emotion,
                    DATE(date) AS call_date,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY emotion, call_date
            )
            , top_destinations AS (
                SELECT 
                    dest_number,
                    COUNT(*) AS count
                FROM filtered_data
                WHERE dest_number IS NOT NULL
                GROUP BY dest_number
                ORDER BY count DESC
                LIMIT 10
            )
            , forbidden_words_count AS (
                SELECT 
                    unnest("forbiddenWords") AS forbidden_word,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY forbidden_word
                ORDER BY count DESC
            )
            , key_words_count AS (
                SELECT 
                    unnest("keyWords") AS key_word,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY key_word
                ORDER BY count DESC
            )
            SELECT 
                (SELECT jsonb_agg(t) FROM topic_distribution t) AS topic_pie_chart,
                (SELECT jsonb_agg(tt) FROM topic_trend tt) AS topic_line_chart,
                (SELECT jsonb_agg(e) FROM emotion_distribution e) AS emotion_pie_chart,
                (SELECT jsonb_agg(et) FROM emotion_trend et) AS emotion_line_chart,
                (SELECT jsonb_agg(td) FROM top_destinations td) AS top_destinations,
                (SELECT jsonb_agg(fw) FROM forbidden_words_count fw) AS forbidden_words_table,
                (SELECT jsonb_agg(kw) FROM key_words_count kw) AS key_words_table;
        `;

            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", result);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.error(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session events", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

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
            fs.mkdirSync(dir, {recursive: true});
        }

        await downloadAndSaveAudio(`${fileName}`, filePath, auth);


    } catch (error) {
        console.error("Error sending audio requests:", error);
        throw new Error("Failed to send and save audio streams.");
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
        throw new Error("Failed to send files for transcription.");
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
        return `http://localhost:9000/${BUCKET_NAME}/${objectName}`;
    } catch (error) {
        console.error("Error uploading to MinIO:", error);
        throw new Error("Failed to upload file to MinIO.");
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
        throw new Error("Failed to send transcription for analysis.");
    }
};


export const sessionEventController = new SessionEventController();
