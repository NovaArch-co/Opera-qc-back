import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class AudioRepository {
    /**
     * Gets all session events from the database
     */
    public static async getAllSessionEvents() {
        return prisma.sessionEvent.findMany({
            orderBy: {
                id: 'asc',
            },
        });
    }

    /**
     * Gets session events with ID greater than the provided lastId
     * @param lastId The ID to start from (exclusive)
     */
    public static async getSessionEventsAfterLastId(lastId: number) {
        return prisma.sessionEvent.findMany({
            where: {
                id: {
                    gt: lastId,
                },
            },
            orderBy: {
                id: 'asc',
            },
        });
    }
} 