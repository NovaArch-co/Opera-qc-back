import { PrismaClient } from '@prisma/client';
import { env } from './envConfig';

const prismaClientSingleton = () => {
    return new PrismaClient({
        datasources: {
            db: {
                url: env.DATABASE_URL
            }
        }
    });
};

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

export default prisma; 