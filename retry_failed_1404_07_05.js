#!/usr/bin/env node

// Script to retry failed transcriptions from 1404-07-05
// This will re-queue the failed transcription jobs

const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Configuration
const BATCH_SIZE = 10; // Process 10 at a time to avoid overwhelming the system
const DELAY_BETWEEN_BATCHES = 5000; // 5 second delay between batches
const TRANSCRIPTION_API = 'http://31.184.134.153:8003/process/';
const FILE_SERVER_BASE = 'http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=';
const FILE_SERVER_AUTH = {
    username: 'Tipax',
    password: 'Goz@r!SimotelTip@x!1404'
};

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadFile(url, outputPath) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            auth: FILE_SERVER_AUTH
        });
        fs.writeFileSync(outputPath, Buffer.from(response.data));
        return true;
    } catch (error) {
        console.error(`Failed to download ${url}:`, error.message);
        return false;
    }
}

async function transcribeFiles(inFile, outFile) {
    try {
        const FormData = require('form-data');
        const form = new FormData();
        
        form.append('customer', fs.createReadStream(inFile));
        form.append('agent', fs.createReadStream(outFile));
        
        const response = await axios.post(TRANSCRIPTION_API, form, {
            headers: {
                ...form.getHeaders(),
                'accept': 'application/json'
            },
            timeout: 120000 // 2 minute timeout
        });
        
        return response.data;
    } catch (error) {
        console.error('Transcription API error:', error.message);
        return null;
    }
}

async function updateSessionWithTranscription(sessionId, transcriptionData) {
    try {
        const analysisData = transcriptionData.analysis || {};
        
        await prisma.sessionEvent.update({
            where: { id: sessionId },
            data: {
                transcription: transcriptionData.transcription,
                explanation: analysisData.explanation?.[0] || null,
                category: analysisData.category?.[0] || null,
                topic: analysisData.topic || null,
                emotion: analysisData.emotion?.[0] || null,
                keyWords: analysisData.keywords || [],
                routinCheckStart: analysisData.routinCheckStart || null,
                routinCheckEnd: analysisData.routinCheckEnd || null,
                forbiddenWords: analysisData.forbiddenWords || null,
            }
        });
        
        return true;
    } catch (error) {
        console.error(`Failed to update session ${sessionId}:`, error.message);
        return false;
    }
}

async function processFailedCall(call) {
    console.log(`Processing call ${call.id}: ${call.filename}`);
    
    const tempDir = '/tmp/transcription_retry';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const inFile = path.join(tempDir, `${call.filename}-in.wav`);
    const outFile = path.join(tempDir, `${call.filename}-out.wav`);
    
    try {
        // Download files
        console.log(`  Downloading files for ${call.filename}...`);
        const inUrl = `${FILE_SERVER_BASE}${call.filename}-in`;
        const outUrl = `${FILE_SERVER_BASE}${call.filename}-out`;
        
        const inDownloaded = await downloadFile(inUrl, inFile);
        const outDownloaded = await downloadFile(outUrl, outFile);
        
        if (!inDownloaded || !outDownloaded) {
            console.log(`  ❌ Failed to download files for ${call.filename}`);
            return false;
        }
        
        // Check file sizes
        const inSize = fs.statSync(inFile).size;
        const outSize = fs.statSync(outFile).size;
        
        if (inSize === 0 || outSize === 0) {
            console.log(`  ❌ Empty files for ${call.filename} (in: ${inSize}, out: ${outSize})`);
            return false;
        }
        
        console.log(`  Files downloaded (in: ${inSize} bytes, out: ${outSize} bytes)`);
        
        // Transcribe
        console.log(`  Transcribing ${call.filename}...`);
        const transcriptionResult = await transcribeFiles(inFile, outFile);
        
        if (!transcriptionResult) {
            console.log(`  ❌ Transcription failed for ${call.filename}`);
            return false;
        }
        
        // Update database
        console.log(`  Updating database for ${call.filename}...`);
        const updated = await updateSessionWithTranscription(call.id, transcriptionResult);
        
        if (updated) {
            console.log(`  ✅ Successfully processed ${call.filename}`);
        } else {
            console.log(`  ❌ Failed to update database for ${call.filename}`);
        }
        
        return updated;
        
    } finally {
        // Clean up temporary files
        try {
            if (fs.existsSync(inFile)) fs.unlinkSync(inFile);
            if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
        } catch (cleanupError) {
            console.warn(`Failed to cleanup files for ${call.filename}:`, cleanupError.message);
        }
    }
}

async function main() {
    console.log('🚀 Starting failed transcription retry for 1404-07-05');
    console.log('========================================');
    
    try {
        // Get failed calls
        const failedCalls = await prisma.sessionEvent.findMany({
            where: {
                date: {
                    gte: new Date('1404-07-05 00:00:00'),
                    lt: new Date('1404-07-06 00:00:00')
                },
                transcription: null
            },
            select: {
                id: true,
                filename: true,
                date: true
            },
            orderBy: {
                date: 'asc'
            }
        });
        
        console.log(`Found ${failedCalls.length} failed calls to retry`);
        
        if (failedCalls.length === 0) {
            console.log('No failed calls found. Exiting.');
            return;
        }
        
        let successful = 0;
        let failed = 0;
        
        // Process in batches
        for (let i = 0; i < failedCalls.length; i += BATCH_SIZE) {
            const batch = failedCalls.slice(i, i + BATCH_SIZE);
            console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} calls):`);
            
            const batchPromises = batch.map(call => processFailedCall(call));
            const batchResults = await Promise.allSettled(batchPromises);
            
            batchResults.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    successful++;
                } else {
                    failed++;
                    console.log(`  ❌ Failed to process ${batch[index].filename}: ${result.reason || 'Unknown error'}`);
                }
            });
            
            console.log(`Batch completed. Success: ${successful}, Failed: ${failed}`);
            
            // Wait between batches
            if (i + BATCH_SIZE < failedCalls.length) {
                console.log(`Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
                await sleep(DELAY_BETWEEN_BATCHES);
            }
        }
        
        console.log('\n========================================');
        console.log('🎯 FINAL RESULTS:');
        console.log(`Total calls processed: ${failedCalls.length}`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Success rate: ${((successful / failedCalls.length) * 100).toFixed(1)}%`);
        
    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Handle script termination
process.on('SIGINT', async () => {
    console.log('\nScript interrupted. Cleaning up...');
    await prisma.$disconnect();
    process.exit(0);
});

// Run the script
main().catch(console.error);
