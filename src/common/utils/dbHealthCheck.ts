import prisma from './prisma';
import { env } from './envConfig';

/**
 * Checks if the database connection is healthy
 * @returns Promise<boolean> - True if the connection is healthy, false otherwise
 */
export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        // Try to execute a simple query to check if the connection is working
        await prisma.$queryRaw`SELECT 1`;
        console.log('Database connection is healthy');
        return true;
    } catch (error) {
        console.error('Database connection error:', error);
        return false;
    }
}

/**
 * Attempts to reconnect to the database
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Promise<boolean> - True if reconnection was successful, false otherwise
 */
export async function reconnectToDatabase(
    maxRetries = 5,
    retryDelay = 1000
): Promise<boolean> {
    let retries = 0;

    while (retries < maxRetries) {
        try {
            console.log(`Attempting to reconnect to database (attempt ${retries + 1}/${maxRetries})...`);

            // Disconnect and reconnect
            await prisma.$disconnect();
            await prisma.$connect();

            // Verify connection
            const isHealthy = await checkDatabaseConnection();
            if (isHealthy) {
                console.log('Successfully reconnected to database');
                return true;
            }
        } catch (error) {
            console.error(`Reconnection attempt ${retries + 1} failed:`, error);
        }

        retries++;
        if (retries < maxRetries) {
            console.log(`Waiting ${retryDelay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    console.error(`Failed to reconnect to database after ${maxRetries} attempts`);
    return false;
}

/**
 * Initializes the database connection with retry logic
 * @returns Promise<void>
 */
export async function initializeDatabase(): Promise<void> {
    const isHealthy = await checkDatabaseConnection();

    if (!isHealthy) {
        console.log('Initial database connection failed, attempting to reconnect...');
        const reconnected = await reconnectToDatabase();

        if (!reconnected) {
            console.error('Failed to establish database connection. Application may not function correctly.');
        }
    }
} 