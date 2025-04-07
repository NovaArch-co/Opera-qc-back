const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

async function fetchSessionEvent() {
    console.log('Connecting to database...');
    console.log(`Database URL: ${process.env.DATABASE_URL}`);

    const prisma = new PrismaClient();

    try {
        console.log('Fetching session event with destNumber = 209...');

        const sessionEvent = await prisma.sessionEvent.findFirst({
            where: {
                destNumber: '209'
            }
        });

        if (sessionEvent) {
            console.log('Session event found:');
            console.log(JSON.stringify(sessionEvent, null, 2));
        } else {
            console.log('No session event found with destNumber = 209');
        }
    } catch (error) {
        console.error('Error fetching session event:', error);
    } finally {
        await prisma.$disconnect();
        console.log('Database connection closed');
    }
}

// Run the function
fetchSessionEvent()
    .then(() => {
        console.log('Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    }); 