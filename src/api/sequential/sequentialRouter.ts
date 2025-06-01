import express from "express";
import { SequentialJobController } from "./sequentialController";
import multer from "multer";

export const sequentialRouter = express.Router();
const sequentialJobController = new SequentialJobController();

// Configure multer for file uploads - store files in memory as buffer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit per file
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    }
});

/**
 * @openapi
 * /api/sequential/jobs:
 *   post:
 *     tags:
 *       - Sequential Jobs
 *     summary: Add a job to the sequential queue
 *     description: Add a job to be processed sequentially (one after another)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - data
 *             properties:
 *               type:
 *                 type: string
 *                 description: The type of job to process
 *               data:
 *                 type: object
 *                 description: The data for the job
 *     responses:
 *       200:
 *         description: Job added successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
sequentialRouter.post("/jobs", sequentialJobController.addJob);

/**
 * @openapi
 * /api/sequential/jobs/upload:
 *   post:
 *     tags:
 *       - Sequential Jobs
 *     summary: Upload customer and agent audio files for sequential processing
 *     description: Upload audio files directly and start sequential processing without downloading
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - customer
 *               - agent
 *             properties:
 *               customer:
 *                 type: string
 *                 format: binary
 *                 description: Customer audio file (wav, mp3, etc.)
 *               agent:
 *                 type: string
 *                 format: binary
 *                 description: Agent audio file (wav, mp3, etc.)
 *               type:
 *                 type: string
 *                 description: Call type (default "uploaded")
 *                 default: uploaded
 *               sourceChannel:
 *                 type: string
 *                 description: Source channel
 *               sourceNumber:
 *                 type: string
 *                 description: Source phone number
 *               queue:
 *                 type: string
 *                 description: Queue name
 *               destChannel:
 *                 type: string
 *                 description: Destination channel
 *               destNumber:
 *                 type: string
 *                 description: Destination phone number
 *               duration:
 *                 type: number
 *                 description: Call duration in seconds
 *               date:
 *                 type: string
 *                 format: date-time
 *                 description: Call date and time
 *     responses:
 *       200:
 *         description: Files uploaded and processing started successfully
 *       400:
 *         description: Bad request - missing files or invalid file types
 *       500:
 *         description: Server error
 */
sequentialRouter.post("/jobs/upload", upload.fields([
    { name: 'customer', maxCount: 1 },
    { name: 'agent', maxCount: 1 }
]), sequentialJobController.addJobWithFiles);

/**
 * @openapi
 * /api/sequential/jobs/{jobId}/status:
 *   get:
 *     tags:
 *       - Sequential Jobs
 *     summary: Get the status of a sequential job
 *     description: Returns the current status of a job in the sequential queue
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the job to get status for
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Job not found
 *       500:
 *         description: Server error
 */
sequentialRouter.get("/jobs/:jobId/status", sequentialJobController.getJobStatus);

/**
 * @openapi
 * /api/sequential/jobs:
 *   get:
 *     tags:
 *       - Sequential Jobs
 *     summary: Get all sequential jobs
 *     description: Returns all jobs in different states
 *     responses:
 *       200:
 *         description: Jobs retrieved successfully
 *       500:
 *         description: Server error
 */
sequentialRouter.get("/jobs", sequentialJobController.getAllJobs); 