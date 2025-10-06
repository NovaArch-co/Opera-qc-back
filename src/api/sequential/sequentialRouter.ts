import express from "express";
import { SequentialJobController } from "./sequentialController";

export const sequentialRouter = express.Router();
const sequentialJobController = new SequentialJobController();

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