# MinIO Audio Files Cleanup Script

This script removes audio files from your MinIO storage that are older than 2 days to free up storage space.

## 🚀 Quick Start

### Dry Run (Safe - Preview Only)
```bash
./cleanup_old_audio.sh --dry-run
```
This shows you what files would be deleted without actually deleting them.

### Actual Cleanup
```bash
./cleanup_old_audio.sh
```
This will permanently delete old files after a 5-second countdown.

## 📋 What It Does

- Connects to MinIO at `http://31.184.134.153:9005`
- Scans the `audio-files` bucket
- Finds all files older than **2 days**
- Deletes them in batches for efficiency
- Shows detailed progress and statistics

## ⚙️ Configuration

The script uses these default settings:
- **MinIO Endpoint**: `http://31.184.134.153:9005`
- **Bucket**: `audio-files`
- **Retention**: 2 days
- **Credentials**: From docker-compose.yml (`minioaccesskey`/`miniosecretkey`)

### Environment Variables (Optional)

You can override the defaults by setting these environment variables:

```bash
export MINIO_CLEANUP_ENDPOINT="http://your-minio-server:9005"
export MINIO_CLEANUP_ACCESS_KEY="your-access-key"
export MINIO_CLEANUP_SECRET_KEY="your-secret-key"
```

## 📊 Sample Output

```
🧹 MinIO Audio Files Cleanup
============================

Configuration:
  MinIO Endpoint: http://31.184.134.153:9005
  Bucket: audio-files
  Retention: 2 days

🗓️  Cutoff date: 2025-09-24T18:57:21.205Z

📋 Listing all objects in bucket...
📊 Found 320178 total objects
🗑️  Found 312336 objects older than 2 days
📏 Total size to be deleted: 616.81 GB

📝 Examples of files to be deleted:
  - 14040217-122550-09965901021-2639-in.wav (0 Bytes, modified: 2025-07-29T09:27:40.131Z)
  - 14040217-122550-09965901021-2639-out.wav (0 Bytes, modified: 2025-07-29T09:27:40.141Z)
  - ... and 312326 more files

🚀 Starting deletion process...
✅ Successfully deleted: 312336 files
💾 Space freed: 616.81 GB
🎉 Cleanup completed successfully!
```

## 🛡️ Safety Features

- **Dry-run mode**: Always test with `--dry-run` first
- **5-second countdown**: Gives you time to cancel with Ctrl+C
- **Detailed logging**: Shows exactly what's being deleted
- **Batch processing**: Efficient deletion in groups of 1000 files
- **Error handling**: Continues even if some files fail to delete

## 📁 Files

- `cleanup_old_audio.sh` - Main shell script wrapper
- `cleanup-old-audio-files.js` - Core Node.js cleanup logic

## 🔧 Troubleshooting

### Connection Issues
If you get connection errors:
1. Check that MinIO is running: `curl -I http://31.184.134.153:9005`
2. Verify credentials match your docker-compose.yml
3. Ensure the bucket `audio-files` exists

### Permission Issues
If you get "InvalidAccessKeyId" errors:
1. Check that the MinIO credentials are correct
2. Verify the MinIO server is using the expected credentials
3. Try connecting with a MinIO client tool first

### Large Number of Files
The script handles large numbers of files efficiently:
- Processes files in batches of 1000
- Shows progress updates
- Continues even if some deletions fail

## ⚠️ Important Notes

- **This permanently deletes files** - there's no undo
- **Always run with `--dry-run` first** to preview changes
- Files are deleted based on their **last modified date** in MinIO
- The script only affects the `audio-files` bucket
- Retention period is currently hardcoded to 2 days

## 🔄 Automation

To run this automatically (e.g., daily), you can add it to crontab:

```bash
# Run cleanup daily at 2 AM
0 2 * * * cd /path/to/Opera-qc-back && ./cleanup_old_audio.sh >> /var/log/minio-cleanup.log 2>&1
```

## 📞 Support

If you encounter issues:
1. Check the error messages in the output
2. Try running with `--dry-run` first
3. Verify your MinIO server is accessible
4. Check the credentials match your docker-compose.yml configuration
