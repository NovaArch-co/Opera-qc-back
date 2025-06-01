import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { addSequentialJob, sequentialQueue } from "@/queue/sequentialQueue";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

export class SequentialJobController {

    public addJob = async (req: Request, res: Response) => {
        try {
            const { type, data } = req.body;

            // Validate required fields
            if (!type || !data) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Missing required fields (type and data)",
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST
                });
            }

            // Add job to sequential queue
            const job = await addSequentialJob(type, data);

            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Sequential job added successfully",
                data: {
                    jobId: job.id,
                    status: "waiting"
                },
                statusCode: StatusCodes.OK
            });
        } catch (error) {
            console.error('Error adding sequential job:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Error adding sequential job",
                data: null,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            });
        }
    };

    public addJobWithFiles = async (req: Request, res: Response) => {
        try {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

            if (!files || !files.customer || !files.agent) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Both customer and agent audio files are required",
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST
                });
            }

            const customerFile = files.customer[0];
            const agentFile = files.agent[0];

            // Validate file types (optional - you can adjust these rules)
            const allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg'];
            if (!allowedMimeTypes.includes(customerFile.mimetype) || !allowedMimeTypes.includes(agentFile.mimetype)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Invalid file type. Only audio files are allowed (wav, mp3, mpeg, ogg)",
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST
                });
            }

            // Get additional metadata from request body
            const {
                type = "uploaded",
                sourceChannel = "",
                sourceNumber = "",
                queue = "",
                destChannel = "",
                destNumber = "",
                duration = 0,
                date = new Date().toISOString()
            } = req.body;

            // Create temporary directory for processing
            const tempDir = path.join(os.tmpdir(), 'opera-qc-uploads');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generate unique filenames
            const timestamp = Date.now();
            const customerFileName = `${timestamp}-customer.wav`;
            const agentFileName = `${timestamp}-agent.wav`;

            const customerFilePath = path.join(tempDir, customerFileName);
            const agentFilePath = path.join(tempDir, agentFileName);

            // Save uploaded files to temp directory
            fs.writeFileSync(customerFilePath, customerFile.buffer);
            fs.writeFileSync(agentFilePath, agentFile.buffer);

            // Add job to sequential queue with file processing
            const job = await addSequentialJob('process-uploaded-session', {
                type,
                sourceChannel,
                sourceNumber,
                queue,
                destChannel,
                destNumber,
                date: new Date(date),
                duration: Number(duration),
                customerFilePath,
                agentFilePath,
                originalCustomerName: customerFile.originalname,
                originalAgentName: agentFile.originalname,
                filename: `${timestamp}-session` // Generate a session filename
            });

            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Files uploaded and sequential processing started",
                data: {
                    jobId: job.id,
                    status: "waiting",
                    customerFile: customerFile.originalname,
                    agentFile: agentFile.originalname
                },
                statusCode: StatusCodes.OK
            });

        } catch (error) {
            console.error('Error adding job with files:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Error processing uploaded files",
                data: null,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            });
        }
    };

    public getJobStatus = async (req: Request, res: Response) => {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Job ID is required",
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST
                });
            }

            const job = await sequentialQueue.getJob(jobId);

            if (!job) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    message: "Job not found",
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND
                });
            }

            const state = await job.getState();
            const progress = job.progress;
            const result = job.returnvalue;
            const failedReason = job.failedReason;

            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Job status retrieved successfully",
                data: {
                    jobId: job.id,
                    state,
                    progress,
                    result,
                    failedReason
                },
                statusCode: StatusCodes.OK
            });
        } catch (error) {
            console.error('Error getting job status:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Error retrieving job status",
                data: null,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            });
        }
    };

    public getAllJobs = async (req: Request, res: Response) => {
        try {
            // Get jobs in different states
            const waitingJobs = await sequentialQueue.getWaiting();
            const activeJobs = await sequentialQueue.getActive();
            const completedJobs = await sequentialQueue.getCompleted();
            const failedJobs = await sequentialQueue.getFailed();
            const delayedJobs = await sequentialQueue.getDelayed();

            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Jobs retrieved successfully",
                data: {
                    waiting: waitingJobs.map(job => ({ id: job.id, data: job.data })),
                    active: activeJobs.map(job => ({ id: job.id, data: job.data })),
                    completed: completedJobs.map(job => ({ id: job.id, data: job.data, returnvalue: job.returnvalue })),
                    failed: failedJobs.map(job => ({ id: job.id, data: job.data, failedReason: job.failedReason })),
                    delayed: delayedJobs.map(job => ({ id: job.id, data: job.data }))
                },
                statusCode: StatusCodes.OK
            });
        } catch (error) {
            console.error('Error getting all jobs:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Error retrieving jobs",
                data: null,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            });
        }
    };
} 