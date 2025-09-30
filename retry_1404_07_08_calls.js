#!/usr/bin/env node

/**
 * Retry Failed Transcription Calls from 1404-07-08
 * 
 * This script retries all 3,325 calls from 1404-07-08 that have no transcriptions
 * The original transcription jobs failed but are now cleared from Redis
 */

const { PrismaClient } = require('@prisma/client');
const { transcriptionQueue } = require('./src/queue/transcriptionQueue');

const prisma = new PrismaClient();

async function retryFailedCalls14040708() {
    console.log('=========================================');
    console.log('  RETRYING FAILED CALLS FROM 1404-07-08');
    console.log('=========================================');
    console.log('Generated at:', new Date().toLocaleString());
    console.log('');

    try {
        // Get all calls from 1404-07-08 that have no transcription
        console.log('🔍 Finding calls from 1404-07-08 without transcriptions...');
        
        const failedCalls = await prisma.sessionEvent.findMany({
            where: {
                date: {
                    gte: new Date('2025-09-29T00:00:00.000Z'), // 1404-07-08 start
                    lt: new Date('2025-09-30T00:00:00.000Z')   // 1404-07-08 end
                },
                transcription: null,
                incomingfileUrl: {
                    not: null
                },
                outgoingfileUrl: {
                    not: null
                }
            },
            select: {
                id: true,
                filename: true,
                date: true,
                incomingfileUrl: true,
                outgoingfileUrl: true
            },
            orderBy: {
                date: 'asc'
            }
        });

        console.log(`📊 Found ${failedCalls.length} calls to retry`);
        console.log('');

        if (failedCalls.length === 0) {
            console.log('✅ No calls found to retry!');
            return;
        }

        // Show sample of calls to retry
        console.log('📋 Sample calls to retry:');
        failedCalls.slice(0, 5).forEach((call, index) => {
            console.log(`  ${index + 1}. ${call.filename} (ID: ${call.id})`);
        });
        console.log('');

        // Process in batches to avoid overwhelming the system
        const batchSize = 50;
        let processed = 0;
        let queued = 0;
        let errors = 0;

        console.log(`🚀 Starting retry process in batches of ${batchSize}...`);
        console.log('');

        for (let i = 0; i < failedCalls.length; i += batchSize) {
            const batch = failedCalls.slice(i, i + batchSize);
            
            console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(failedCalls.length / batchSize)} (${batch.length} calls)...`);

            for (const call of batch) {
                try {
                    // Queue transcription job
                    await transcriptionQueue.add('transcription-processing', {
                        sessionEventId: call.id,
                        customerFilePath: `/tmp/opera-qc/${call.filename}-in.wav`,
                        agentFilePath: `/tmp/opera-qc/${call.filename}-out.wav`,
                        filename: call.filename
                    }, {
                        jobId: `retry-${call.id}-${Date.now()}`,
                        removeOnComplete: 100,
                        removeOnFail: 500,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000
                        }
                    });

                    queued++;
                    processed++;

                    if (processed % 100 === 0) {
                        console.log(`  ✅ Queued ${processed}/${failedCalls.length} calls...`);
                    }

                } catch (error) {
                    console.error(`  ❌ Error queuing call ${call.id}:`, error.message);
                    errors++;
                }
            }

            // Small delay between batches to avoid overwhelming the system
            if (i + batchSize < failedCalls.length) {
                console.log(`  ⏳ Waiting 2 seconds before next batch...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log('');
        console.log('🎯 RETRY SUMMARY:');
        console.log('==================');
        console.log(`📊 Total calls found: ${failedCalls.length}`);
        console.log(`✅ Successfully queued: ${queued}`);
        console.log(`❌ Errors: ${errors}`);
        console.log(`📈 Success rate: ${((queued / failedCalls.length) * 100).toFixed(1)}%`);
        console.log('');

        console.log('🔍 MONITORING COMMANDS:');
        console.log('========================');
        console.log('# Check queue status:');
        console.log('docker exec -it opera-qc-redis redis-cli');
        console.log('LLEN bull:transcription-processing:waiting');
        console.log('LLEN bull:transcription-processing:failed');
        console.log('');
        console.log('# Monitor transcription progress:');
        console.log('watch -n 10 "docker exec -e PGPASSWORD=\'StrongP@ssw0rd123\' postgres psql -U postgres -d opera_qc -c \\"SELECT COUNT(*) FROM \\\\\\"SessionEvent\\\\\\" WHERE DATE(date) = \\\\\\"1404-07-08\\\\\\" AND transcription IS NOT NULL;\\""');
        console.log('');

        console.log('🚀 Expected Results:');
        console.log('===================');
        console.log('✅ 3,325 calls queued for transcription');
        console.log('✅ High success rate (>90%)');
        console.log('✅ Transcription data populated');
        console.log('✅ Complete data recovery for 1404-07-08');
        console.log('');

    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the retry process
retryFailedCalls14040708().catch(console.error);
