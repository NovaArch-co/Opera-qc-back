import type { Request, RequestHandler, Response } from "express";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { AudioRepository } from "./audioRepository";

class AudioController {
    /**
     * Get all session events or only those with ID greater than lastId
     * Uses streaming to handle large result sets more efficiently
     */
    public getSessionEvents: RequestHandler = async (req: Request, res: Response) => {
        try {
            // Extract parameters from query
            const lastId = req.query.lastId ? parseInt(req.query.lastId as string, 10) : undefined;
            const batchSize = req.query.batchSize ? parseInt(req.query.batchSize as string, 10) : 1000;

            // Validate batch size (prevent extreme values)
            const validBatchSize = Math.max(100, Math.min(batchSize, 5000));

            // Start the response with a JSON array opening bracket
            res.setHeader('Content-Type', 'application/json');
            // Set headers to prevent timeouts and ensure streaming
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('X-Accel-Buffering', 'no'); // For NGINX

            res.write('{"data":[');

            let isFirstBatch = true;
            let isFirstItem = true;

            // Stream the session events in batches
            for await (const batch of AudioRepository.streamSessionEvents(lastId, validBatchSize)) {
                if (!isFirstBatch) {
                    // If not the first batch, we need to separate batches with commas
                    res.write(',');
                }

                for (const item of batch) {
                    if (!isFirstItem) {
                        // If not the first item, add a comma separator
                        res.write(',');
                    }
                    // Write the item as JSON
                    res.write(JSON.stringify(item));
                    isFirstItem = false;
                }

                isFirstBatch = false;

                // Ensure data is sent immediately
                // Express doesn't have a direct flush method, data will be sent based on Node's internal mechanisms
            }

            // Close the JSON array and object
            res.write(']}');
            res.end();

        } catch (error) {
            console.error("Error retrieving session events:", error);
            const serviceResponse = ServiceResponse.failure("Error retrieving session events", null);
            return handleServiceResponse(serviceResponse, res);
        }
    }
}

export const audioController = new AudioController(); 