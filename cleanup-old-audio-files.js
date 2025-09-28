#!/usr/bin/env node

const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Configuration - Use external endpoint when running outside Docker
// Override with docker-compose credentials since .env might have different values
const MINIO_ENDPOINT_URL = process.env.MINIO_CLEANUP_ENDPOINT || 'http://31.184.134.153:9005';
const MINIO_ACCESS_KEY = process.env.MINIO_CLEANUP_ACCESS_KEY || 'minioaccesskey';
const MINIO_SECRET_KEY = process.env.MINIO_CLEANUP_SECRET_KEY || 'miniosecretkey';
const BUCKET_NAME = 'audio-files';
const DAYS_TO_KEEP = 2;

// Helper function to ensure endpoint has protocol
function getMinioEndpoint() {
    const endpoint = MINIO_ENDPOINT_URL || 'localhost:9005';
    
    // If endpoint already includes protocol, return as is
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }
    
    // Otherwise, add http:// protocol
    return `http://${endpoint}`;
}

// Initialize S3 Client for MinIO
const s3Client = new S3Client({
    region: 'us-east-1',
    endpoint: getMinioEndpoint(),
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true,
    tls: false,
});

/**
 * Get cutoff date (2 days ago)
 */
function getCutoffDate() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP);
    return cutoff;
}

/**
 * List all objects in the bucket
 */
async function listAllObjects() {
    const objects = [];
    let continuationToken = undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            ContinuationToken: continuationToken,
        });

        try {
            const response = await s3Client.send(command);
            
            if (response.Contents) {
                objects.push(...response.Contents);
            }
            
            continuationToken = response.NextContinuationToken;
        } catch (error) {
            console.error('Error listing objects:', error);
            throw error;
        }
    } while (continuationToken);

    return objects;
}

/**
 * Filter objects older than the cutoff date
 */
function filterOldObjects(objects, cutoffDate) {
    return objects.filter(obj => {
        if (!obj.LastModified) return false;
        return obj.LastModified < cutoffDate;
    });
}

/**
 * Delete objects in batches (max 1000 per batch as per AWS S3 API limit)
 */
async function deleteObjectsBatch(objectsToDelete) {
    if (objectsToDelete.length === 0) {
        console.log('No objects to delete.');
        return;
    }

    const batchSize = 1000;
    let deletedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < objectsToDelete.length; i += batchSize) {
        const batch = objectsToDelete.slice(i, i + batchSize);
        
        const deleteParams = {
            Bucket: BUCKET_NAME,
            Delete: {
                Objects: batch.map(obj => ({ Key: obj.Key })),
                Quiet: false, // Set to false to get detailed response
            },
        };

        try {
            const command = new DeleteObjectsCommand(deleteParams);
            const response = await s3Client.send(command);
            
            if (response.Deleted) {
                deletedCount += response.Deleted.length;
                console.log(`Successfully deleted ${response.Deleted.length} objects in this batch`);
                
                // Log some examples of deleted files
                response.Deleted.slice(0, 5).forEach(deleted => {
                    console.log(`  - Deleted: ${deleted.Key}`);
                });
                if (response.Deleted.length > 5) {
                    console.log(`  - ... and ${response.Deleted.length - 5} more files`);
                }
            }
            
            if (response.Errors) {
                failedCount += response.Errors.length;
                console.error(`Failed to delete ${response.Errors.length} objects in this batch:`);
                response.Errors.forEach(error => {
                    console.error(`  - Error deleting ${error.Key}: ${error.Message}`);
                });
            }
        } catch (error) {
            console.error(`Error deleting batch starting at index ${i}:`, error);
            failedCount += batch.length;
        }
    }

    return { deletedCount, failedCount };
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Main cleanup function
 */
async function cleanupOldAudioFiles() {
    console.log('🧹 Starting MinIO audio files cleanup...');
    console.log(`📅 Removing files older than ${DAYS_TO_KEEP} days`);
    console.log(`🪣 Bucket: ${BUCKET_NAME}`);
    console.log(`🔗 MinIO Endpoint: ${getMinioEndpoint()}`);
    console.log(`🔑 Access Key: ${MINIO_ACCESS_KEY}`);
    console.log(`🗝️  Secret Key: ${MINIO_SECRET_KEY.substring(0, 3)}...`);
    console.log('');

    const cutoffDate = getCutoffDate();
    console.log(`🗓️  Cutoff date: ${cutoffDate.toISOString()}`);
    console.log('');

    try {
        // List all objects
        console.log('📋 Listing all objects in bucket...');
        const allObjects = await listAllObjects();
        console.log(`📊 Found ${allObjects.length} total objects`);
        
        if (allObjects.length === 0) {
            console.log('✅ No objects found in bucket. Nothing to cleanup.');
            return;
        }

        // Filter old objects
        const oldObjects = filterOldObjects(allObjects, cutoffDate);
        console.log(`🗑️  Found ${oldObjects.length} objects older than ${DAYS_TO_KEEP} days`);
        
        if (oldObjects.length === 0) {
            console.log('✅ No old files to cleanup. All files are recent.');
            return;
        }

        // Calculate total size of files to be deleted
        const totalSize = oldObjects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        console.log(`📏 Total size to be deleted: ${formatFileSize(totalSize)}`);
        console.log('');

        // Show some examples of files to be deleted
        console.log('📝 Examples of files to be deleted:');
        oldObjects.slice(0, 10).forEach(obj => {
            console.log(`  - ${obj.Key} (${formatFileSize(obj.Size || 0)}, modified: ${obj.LastModified?.toISOString()})`);
        });
        if (oldObjects.length > 10) {
            console.log(`  - ... and ${oldObjects.length - 10} more files`);
        }
        console.log('');

        // Confirm deletion (in production, you might want to add a confirmation prompt)
        console.log('🚀 Starting deletion process...');
        
        // Delete objects in batches
        const result = await deleteObjectsBatch(oldObjects);
        
        console.log('');
        console.log('📈 Cleanup Summary:');
        console.log(`✅ Successfully deleted: ${result.deletedCount} files`);
        console.log(`❌ Failed to delete: ${result.failedCount} files`);
        console.log(`💾 Space freed: ${formatFileSize(totalSize)}`);
        
        if (result.failedCount > 0) {
            console.log('⚠️  Some files could not be deleted. Check the error messages above.');
            process.exit(1);
        } else {
            console.log('🎉 Cleanup completed successfully!');
        }

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    }
}

// Add dry-run option
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be deleted');
    console.log('');
    
    // Modify the deleteObjectsBatch function for dry run
    const originalDeleteObjectsBatch = deleteObjectsBatch;
    global.deleteObjectsBatch = async function(objectsToDelete) {
        console.log(`🔍 DRY RUN: Would delete ${objectsToDelete.length} objects`);
        objectsToDelete.slice(0, 10).forEach(obj => {
            console.log(`  - Would delete: ${obj.Key} (${formatFileSize(obj.Size || 0)})`);
        });
        if (objectsToDelete.length > 10) {
            console.log(`  - ... and ${objectsToDelete.length - 10} more files`);
        }
        return { deletedCount: 0, failedCount: 0 };
    };
    
    // Replace the function
    deleteObjectsBatch = global.deleteObjectsBatch;
}

// Run the cleanup
if (require.main === module) {
    cleanupOldAudioFiles().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { cleanupOldAudioFiles, getCutoffDate, filterOldObjects };
