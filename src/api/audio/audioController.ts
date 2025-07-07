import type { Request, RequestHandler, Response } from "express";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { AudioRepository } from "./audioRepository";

class AudioController {
    /**
     * Get all session events or only those with ID greater than lastId
     */
    public getSessionEvents: RequestHandler = async (req: Request, res: Response) => {
        try {
            // Extract lastId from query parameters (if present)
            const lastId = req.query.lastId ? parseInt(req.query.lastId as string, 10) : undefined;

            let sessionEvents;

            if (lastId !== undefined) {
                // Get session events after the specified ID
                sessionEvents = await AudioRepository.getSessionEventsAfterLastId(lastId);
            } else {
                // Get all session events
                sessionEvents = await AudioRepository.getAllSessionEvents();
            }

            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", {
                data: sessionEvents,
            });

            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.error("Error retrieving session events:", error);
            const serviceResponse = ServiceResponse.failure("Error retrieving session events", null);
            return handleServiceResponse(serviceResponse, res);
        }
    }
}

export const audioController = new AudioController(); 