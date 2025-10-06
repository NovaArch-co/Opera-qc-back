import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { addSequentialJob, sequentialQueue } from "@/queue/sequentialQueue";

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