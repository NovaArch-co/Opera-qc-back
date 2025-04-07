import { PrismaClient } from '@prisma/client';
import { env } from './envConfig';

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: env.DATABASE_URL
            }
        },
        log: ['error', 'warn'],
        connectionLimit: 5,
        pool: {
            min: 2,
            max: 10,
            idleTimeoutMillis: 30000,
            acquireTimeoutMillis: 30000,
        }
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

export default prisma; 