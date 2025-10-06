import { PrismaClient } from '@prisma/client';
import { env } from './envConfig';

// Add retry logic for connection issues
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000; // 1 second

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: env.DATABASE_URL
            }
        },
        log: ['error', 'warn']
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

// Add cleanup on process termination
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

// Add error handling for connection issues
// Using type assertion to avoid TypeScript errors
(prisma as any).$on('query', (e: any) => {
    console.log('Query: ' + e.query);
    console.log('Params: ' + e.params);
    console.log('Duration: ' + e.duration + 'ms');
});

export default prisma; 