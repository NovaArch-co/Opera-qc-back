#!/bin/bash

# Clear failed transcription jobs that are causing errors
# These are old jobs from before the fix that have missing temp files

echo "========================================="
echo "  CLEARING FAILED TRANSCRIPTION JOBS"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔧 PROBLEM:"
echo "  - Old transcription jobs are still in the queue"
echo "  - Temporary files are missing (expected)"
echo "  - Jobs keep failing and retrying"
echo "  - Need to clear these old failed jobs"
echo ""

echo "📋 COMMANDS TO RUN ON PRODUCTION SERVER:"
echo "========================================"
echo ""

echo "# 1. Connect to Redis"
echo "docker exec -it redis redis-cli"
echo ""

echo "# 2. Check current queue status"
echo "LLEN bull:transcription-processing:waiting"
echo "LLEN bull:transcription-processing:failed"
echo "LLEN bull:transcription-processing:completed"
echo ""

echo "# 3. Clear failed jobs"
echo "DEL bull:transcription-processing:failed"
echo ""

echo "# 4. Clear waiting jobs (old ones with missing files)"
echo "DEL bull:transcription-processing:waiting"
echo ""

echo "# 5. Verify queues are cleared"
echo "LLEN bull:transcription-processing:waiting"
echo "LLEN bull:transcription-processing:failed"
echo ""

echo "# 6. Exit Redis"
echo "exit"
echo ""

echo "🎯 EXPECTED RESULTS:"
echo "==================="
echo "✅ Failed job errors stop appearing in logs"
echo "✅ Only new jobs (with proper files) get processed"
echo "✅ Clean slate for transcription queue"
echo "✅ URLs continue to be saved for new calls"
echo ""

echo "⚠️  IMPORTANT NOTES:"
echo "==================="
echo "1. This only clears the job queue, not the database"
echo "2. URLs are already saved for new calls (fix working)"
echo "3. Old failed calls can be retried later with the retry script"
echo "4. This stops the error spam in logs"
echo ""

echo "Run these commands on your production server!"
