import { type Request, type Response } from "express";
import prisma from "@/common/utils/prisma";
import { z } from "zod";
import { SessionEvent } from "@prisma/client";

/**
 * Get calls with filtering capabilities
 */
export const getCalls = async (req: Request, res: Response): Promise<void> => {
    try {
        // Parse query parameters
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const dateFrom = req.query.dateFrom as string;
        const dateTo = req.query.dateTo as string;
        const durationMin = req.query.durationMin ? parseInt(req.query.durationMin as string) : undefined;
        const durationMax = req.query.durationMax ? parseInt(req.query.durationMax as string) : undefined;
        const topic = req.query.topic as string;
        const emotion = req.query.emotion as string;
        const destNumber = req.query.destNumber as string;
        const routineCheckStart = req.query.routineCheckStart as string;
        const routineCheckEnd = req.query.routineCheckEnd as string;

        // Validate parameters
        const schema = z.object({
            page: z.number().positive().int(),
            limit: z.number().positive().int(),
            dateFrom: z.string().optional().refine(
                (val) => !val || !isNaN(Date.parse(val)),
                { message: "Invalid date format for dateFrom" }
            ),
            dateTo: z.string().optional().refine(
                (val) => !val || !isNaN(Date.parse(val)),
                { message: "Invalid date format for dateTo" }
            ),
            durationMin: z.number().positive().int().optional(),
            durationMax: z.number().positive().int().optional(),
            emotion: z.string().optional().refine(
                (val) => !val || ["خوشحال", "ناراحت", "عصبانی"].includes(val),
                { message: "Emotion must be one of: خوشحال, ناراحت, عصبانی" }
            ),
            routineCheckStart: z.enum(["0", "1"]).optional(),
            routineCheckEnd: z.enum(["0", "1"]).optional(),
        }).refine(
            (data) => {
                if (data.dateFrom && data.dateTo) {
                    return new Date(data.dateFrom) <= new Date(data.dateTo);
                }
                return true;
            },
            { message: "dateFrom must be before or equal to dateTo" }
        ).refine(
            (data) => {
                if (data.durationMin !== undefined && data.durationMax !== undefined) {
                    return data.durationMin <= data.durationMax;
                }
                return true;
            },
            { message: "durationMin must be less than or equal to durationMax" }
        );

        const validationResult = schema.safeParse({
            page,
            limit,
            dateFrom,
            dateTo,
            durationMin,
            durationMax,
            emotion,
            routineCheckStart,
            routineCheckEnd
        });

        if (!validationResult.success) {
            res.status(400).json({
                error: "Invalid parameters",
                details: validationResult.error.errors
            });
            return;
        }

        // Build query filters
        const where: any = {};

        // Date range filter
        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) {
                where.date.gte = new Date(dateFrom);
            }
            if (dateTo) {
                // Add one day to dateTo to include the entire day
                const dateToObj = new Date(dateTo);
                dateToObj.setDate(dateToObj.getDate() + 1);
                where.date.lt = dateToObj;
            }
        }

        // Duration filter
        // Note: Duration is stored as a string in the database, so we need to use numeric comparison
        if (durationMin !== undefined || durationMax !== undefined) {
            // Since duration is a string in the schema, we'll need to convert for filtering
            // This approach depends on how duration is stored - may need adjustment
            if (durationMin !== undefined && durationMax !== undefined) {
                where.duration = {
                    gte: durationMin.toString(),
                    lte: durationMax.toString(),
                };
            } else if (durationMin !== undefined) {
                where.duration = {
                    gte: durationMin.toString(),
                };
            } else if (durationMax !== undefined) {
                where.duration = {
                    lte: durationMax.toString(),
                };
            }
        }

        // Topic filter (partial match)
        if (topic) {
            where.topic = {
                path: "$",
                string_contains: topic,
            };
        }

        // Emotion filter
        if (emotion) {
            where.emotion = emotion;
        }

        // Agent ID/destination number filter (partial match)
        if (destNumber) {
            where.destNumber = {
                contains: destNumber,
                mode: "insensitive", // Case-insensitive search
            };
        }

        // Routine check status filters
        if (routineCheckStart) {
            where.routinCheckStart = routineCheckStart;
        }

        if (routineCheckEnd) {
            where.routinCheckEnd = routineCheckEnd;
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const [calls, totalItems] = await Promise.all([
            prisma.sessionEvent.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    date: "desc", // Default sorting by date, newest first
                },
                select: {
                    id: true,
                    destNumber: true,
                    topic: true,
                    category: true,
                    date: true,
                    duration: true,
                    emotion: true,
                    routinCheckStart: true,
                    routinCheckEnd: true,
                    explanation: true,
                    transcription: true,
                    forbiddenWords: true,
                },
            }),
            prisma.sessionEvent.count({ where }),
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalItems / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Transform data if needed to match expected response format
        const transformedCalls = calls.map((call: any) => ({
            id: call.id.toString(),
            destNumber: call.destNumber,
            topic: call.topic ? JSON.stringify(call.topic) : null,
            category: call.category || null,
            date: call.date.toISOString(),
            duration: call.duration,
            emotion: call.emotion || null,
            routinCheckStart: call.routinCheckStart,
            routinCheckEnd: call.routinCheckEnd,
            explanation: call.explanation || null,
            transcription: call.transcription,
            forbiddenWords: call.forbiddenWords,
        }));

        res.status(200).json({
            data: transformedCalls,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                limit,
                hasNextPage,
                hasPrevPage,
            },
        });
    } catch (error) {
        console.error("Error in getCalls:", error);
        res.status(500).json({
            error: "An unexpected error occurred",
            message: error instanceof Error ? error.message : "Unknown error",
        });
    }
}; 