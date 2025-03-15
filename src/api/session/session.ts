import type {Request, RequestHandler, Response} from "express";
import {ServiceResponse} from "@/common/models/serviceResponse";
import {handleServiceResponse} from "@/common/utils/httpHandlers";
import {PrismaClient} from "@prisma/client";
import {StatusCodes} from "http-status-codes";
import moment from 'moment-jalaali';


import {
    AnalysisResponseSchema,
    CreateSessionEventSchema,
    TranscriptionResponseSchema
} from "@/api/session/sessionModel";
import {env} from "@/common/utils/envConfig";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import path from "node:path";
import fs from "node:fs";
import {downloadAndSaveAudio} from "@/common/utils/downloadFileStream";
import FormData from "form-data";
import axios from "axios"; // ✅ Make sure you are using `form-data` package

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

            const baseUrl = env.FILE_SERVER_BASE_URL;
            console.log("INCOMING baseUrl", baseUrl);

            const fileName = filename.replace(".wav", "");

            const filePathIn = `${baseUrl}${fileName}-in`;
            const filePathOut = `${baseUrl}${fileName}-out`;

            console.log("INCOMING filePathIn", filePathIn);
            console.log("OUTGOING filePathOut", filePathOut);

            console.log("sessionEventController.parsedData.data;", parsedData.data);

            const formattedDate = new Date(date.replace(" ", "T") + "Z"); // Converts "YYYY-MM-DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SSZ"


            const fileDestIn = path.join(__dirname, `./audio_files/${fileName}-in.wav`);
            const fileDestOut = path.join(__dirname, `./audio_files/${fileName}-out.wav`);

            await sendAudioRequests(filePathIn, "incoming", fileDestIn);
            await sendAudioRequests(filePathOut, "outgoing", fileDestOut);

            const fileUrlIn = await uploadToMinIO(fileDestIn, `${fileName}-in.wav`);
            const fileUrlOut = await uploadToMinIO(fileDestOut, `${fileName}-out.wav`);


            console.log("INCOMING fileDestIn", fileDestIn);
            console.log("OUTGOING fileDestOut", fileDestOut);

            console.log("INCOMING fileUrlIn", fileUrlIn);
            console.log("OUTGOING fileUrlOut", fileUrlOut);

            const transcribeResponse = await sendFilesToTranscriptionAPI(fileDestIn, fileDestOut);

            const parsedTranscription = TranscriptionResponseSchema.safeParse(transcribeResponse);
            if (!parsedTranscription.success) {
                console.error("Invalid Transcription Data:", parsedTranscription.error.format());
            } else {
                console.log("✅ Valid Transcription Data:", parsedTranscription);
            }

            const analysisResponse = await sendToAnalysisAPI(transcribeResponse);

            const parsedAnalysis = AnalysisResponseSchema.safeParse(analysisResponse);
            if (!parsedAnalysis.success) {
                console.error("Invalid Analysis Data:", parsedAnalysis.error.format());
            } else {
                console.log("✅ Valid Analysis Data:", parsedAnalysis.data);
            }

            const parsedTranscriptionData = parsedTranscription.data
            const parsedAnalysisData = parsedAnalysis.data?.analysis


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
            let sessionEvent = await prisma.sessionEvent.findUnique({
                where: {id: Number(id)},
            });

            if (!sessionEvent) {
                return handleServiceResponse(ServiceResponse.failure("Session event not found", {}, StatusCodes.NOT_FOUND), res);
            }

            const incommingfileUrl = `${env.MINIO_ENDPOINT_UTL}${sessionEvent.incommingfileUrl}`
            const outgoingfileUrl = `${env.MINIO_ENDPOINT_UTL}${sessionEvent.outgoingfileUrl}`
            let sessionEvents = {
                ...sessionEvent,
                incommingfileUrl,
                outgoingfileUrl,
                forbiddenWords: sessionEvent.forbiddenWords ? sessionEvent.forbiddenWords : {},
                topic: (Object.keys(sessionEvent.topic).length > 0) ? Object.keys(sessionEvent.topic)[0] : "",
                subTopic: (Object.values(sessionEvent.topic).length > 0) ? Object.values(sessionEvent.topic)[0] : ""
            }
            const serviceResponse = ServiceResponse.success("Session event retrieved successfully", sessionEvents);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.log(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session event", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getSessions: RequestHandler = async (req: Request, res: Response) => {
        try {
            let {from, to} = req.query;

            // 🛠 Default to last 7 days if no params provided
            if (!from && !to) {
                from = moment().subtract(7, "days").format("jYYYY-jMM-jDD");
                to = moment().format("jYYYY-jMM-jDD");
            } else if (!from && to) {
                from = moment(to, "jYYYY-jMM-jDD").subtract(7, "days").format("jYYYY-jMM-jDD");
            } else if (!to && from) {
                to = moment().format("jYYYY-jMM-jDD") + "T00:00.000Z";
            }

            console.log("Received Jalali Dates:", {from, to});

            // 🛠 Prisma Raw Query to fetch sessions
            const sessionEvents = await prisma.$queryRaw`
            SELECT * FROM "SessionEvent"
            WHERE date BETWEEN ${from}::TIMESTAMP AND ${to}::TIMESTAMP
            ORDER BY date DESC
        `;

            console.log("Fetched Sessions:", sessionEvents.length);

            // 🛠 Format URLs properly
            const formattedSessions = sessionEvents.map(event => ({
                ...event,
                incommingfileUrl: event.incommingfileUrl ? `${env.MINIO_ENDPOINT_UTL}${event.incommingfileUrl}` : null,
                outgoingfileUrl: event.outgoingfileUrl ? `${env.MINIO_ENDPOINT_UTL}${event.outgoingfileUrl}` : null,
                forbiddenWords: event.forbiddenWords || {},
                topic: event.topic && Object.keys(event.topic).length > 0 ? Object.keys(event.topic)[0] : "",
                subTopic: (Object.values(event.topic).length > 0) ? Object.values(event.topic)[0] : ""
            }));

            return handleServiceResponse(
                ServiceResponse.success("Session events retrieved successfully", formattedSessions),
                res
            );

        } catch (error) {
            console.error("Error fetching session events:", error);
            return handleServiceResponse(
                ServiceResponse.failure("Error fetching session events", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };


    public getSessionsByFilter: RequestHandler = async (req: Request, res: Response) => {
        let {from, to} = req.query;

        if (!from && !to) {
            from = moment().subtract(7, "days").format("jYYYY-jMM-jDD");
            to = moment().format("jYYYY-jMM-jDD");
        } else if (!from && to) {
            from = moment().subtract(7, "days").format("jYYYY-jMM-jDD");
        } else if (!to && from) {
            to = moment().format("jYYYY-jMM-jDD");
        }

        console.log("Jalali Dates:", {from, to});

        // Convert Jalali to Gregorian before querying the database
        // const fromGregorian = moment(from, "jYYYY-jMM-jDD").startOf("day").format("YYYY-MM-DD HH:mm:ss");
        // const toGregorian = moment(to, "jYYYY-jMM-jDD").endOf("day").format("YYYY-MM-DD HH:mm:ss");


        // from = from + "T00:00.000Z";
        // to = to + "T00:00.000Z";

        try {

            const result = await prisma.$queryRaw`
            WITH filtered_data AS (
                SELECT * FROM "SessionEvent"
                               WHERE date BETWEEN ${from}::TIMESTAMP AND ${to}::TIMESTAMP
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
                    TO_CHAR(date, 'YYYY-MM-DD') AS call_date,
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
                    TO_CHAR(date, 'YYYY-MM-DD') AS call_date,
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
            , key_words_count AS (
                SELECT
                    unnest("keyWords") AS key_words,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY key_words
                ORDER BY count DESC
            ), forbidden_words_count AS (
                SELECT
                    key AS forbidden_word,
                    SUM(value::int) AS count
                FROM filtered_data,
                LATERAL jsonb_each("forbiddenWords")
                GROUP BY key
                ORDER BY count DESC
               )
            , top_agent_count AS (
                SELECT
                    name,
                    SUM(
                        (split_part(duration, ':', 1)::INT * 3600) +  -- Hours to seconds
                        (split_part(duration, ':', 2)::INT * 60) +    -- Minutes to seconds
                        (split_part(duration, ':', 3)::INT)           -- Seconds
                    ) AS total_duration_seconds,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY name
                ORDER BY count DESC
)
            SELECT
                (SELECT jsonb_agg(t) FROM topic_distribution t) AS topic_pie_chart,
                (SELECT jsonb_agg(tt) FROM topic_trend tt) AS topic_line_chart,
                (SELECT jsonb_agg(e) FROM emotion_distribution e) AS emotion_pie_chart,
                (SELECT jsonb_agg(et) FROM emotion_trend et) AS emotion_line_chart,
                (SELECT jsonb_agg(td) FROM top_destinations td) AS top_destinations,
                (SELECT jsonb_agg(fw) FROM forbidden_words_count fw) AS forbidden_words_table,
                (SELECT jsonb_agg(kw) FROM key_words_count kw) AS key_words_table,
                (SELECT jsonb_agg(ta) FROM top_agent_count ta) AS top_agent_count;
        `;

            const formatLineChart = (data: any[], keyField: string) => {
                const transformedData: Record<string, Record<string, number>> = {};
                data.forEach(({call_date, [keyField]: key, count}) => {
                    if (!transformedData[call_date]) {
                        transformedData[call_date] = {};
                    }
                    transformedData[call_date][key] = count;
                });
                return transformedData;
            };

            const topicLineChart = formatLineChart(result[0]?.topic_line_chart || [], "topic_name");
            const emotionLineChart = formatLineChart(result[0]?.emotion_line_chart || [], "emotion");
            const responseData = {
                topic_pie_chart: result[0]?.topic_pie_chart || [],
                topic_line_chart: topicLineChart,
                emotion_pie_chart: result[0]?.emotion_pie_chart || [],
                emotion_line_chart: emotionLineChart,
                top_destinations: result[0]?.top_destinations || [],
                forbidden_words_table: result[0]?.forbidden_words_table || [],
                key_words_table: result[0]?.key_words_table || [],
                top_agent_count: result[0]?.top_agent_count || [],
            };
            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", responseData);
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

        const response = await axios.post("http://sleepy_greider:8000/transcribe/", form, {
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
        const response = await axios.post("http://sleepy_greider:8000/analyze/", transcriptionData, {
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

export const sessionEventController = new SessionEventController();
