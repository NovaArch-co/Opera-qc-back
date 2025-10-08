import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  // Enable query logging in development
  log: process.env.NODE_ENV === "development" ? ["query"] : [],
});

/**
 * Gets all session events from the database
 */
export async function getAllSessionEvents() {
  return prisma.sessionEvent.findMany({
    orderBy: {
      id: "asc",
    },
  });
}

/**
 * Gets session events with ID greater than the provided lastId
 * @param lastId The ID to start from (exclusive)
 */
export async function getSessionEventsAfterLastId(lastId: number) {
  return prisma.sessionEvent.findMany({
    where: {
      id: {
        gt: lastId,
      },
    },
    orderBy: {
      id: "asc",
    },
  });
}

/**
 * Streams session events in batches to avoid memory issues
 * @param lastId Optional ID to start from (exclusive)
 * @param batchSize Number of records to fetch per batch
 */
export async function* streamSessionEvents(lastId: number | undefined = undefined, batchSize = 1000) {
  let currentLastId = lastId;
  let hasMoreRecords = true;

  while (hasMoreRecords) {
    const query = {
      take: batchSize,
      orderBy: {
        id: "asc" as const,
      },
      ...(currentLastId !== undefined && {
        where: {
          id: {
            gt: currentLastId,
          },
        },
      }),
    };

    const batch = await prisma.sessionEvent.findMany(query);

    if (batch.length === 0) {
      hasMoreRecords = false;
    } else {
      yield batch;
      // Update the last ID for the next batch
      currentLastId = batch[batch.length - 1].id;
    }
  }
}
