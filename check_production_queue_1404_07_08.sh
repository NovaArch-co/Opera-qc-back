#!/bin/bash

# Check Production Queue Status for 1404-07-08 Issue
# 3,325 calls with NO transcriptions - likely queue stuck

echo "========================================="
echo "  PRODUCTION QUEUE STATUS - 1404-07-08"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🚨 CRITICAL ISSUE:"
echo "  - 3,325 calls from 1404-07-08 have ZERO transcriptions"
echo "  - This indicates transcription queue is stuck/overwhelmed"
echo "  - Need to check production server queue status"
echo ""

echo "📋 COMMANDS TO RUN ON PRODUCTION SERVER:"
echo "========================================"
echo ""

echo "# 1. Check Redis transcription queue status"
echo "docker exec -it redis redis-cli"
echo "LLEN bull:transcription-processing:waiting"
echo "LLEN bull:transcription-processing:failed" 
echo "LLEN bull:transcription-processing:completed"
echo "LLEN bull:transcription-processing:active"
echo ""

echo "# 2. Check session queue status"
echo "LLEN bull:session-processing:waiting"
echo "LLEN bull:session-processing:failed"
echo "LLEN bull:session-processing:active"
echo ""

echo "# 3. Check if there are stuck jobs from 1404-07-08"
echo "LRANGE bull:transcription-processing:waiting 0 10"
echo "LRANGE bull:transcription-processing:failed 0 10"
echo ""

echo "# 4. Exit Redis"
echo "exit"
echo ""

echo "# 5. Check application logs for recent errors"
echo "docker logs app --since=\"2025-09-29T00:00:00\" --until=\"2025-09-29T23:59:59\" 2>&1 | grep -i -E '(transcription|queue|error|fail)' | tail -20"
echo ""

echo "# 6. Check transcription API health"
echo "curl -I 'http://31.184.134.153:8003/health'"
echo "curl -I 'http://31.184.134.153:8003/status'"
echo ""

echo "# 7. Check system resources"
echo "docker stats --no-stream"
echo "df -h"
echo "free -h"
echo ""

echo "🔍 LIKELY CAUSES:"
echo "================="
echo "1. 📊 QUEUE OVERLOAD:"
echo "   - 3,325 calls is massive volume"
echo "   - Only 3 concurrent transcription workers"
echo "   - Queue likely backed up beyond capacity"
echo ""

echo "2. 🔧 TRANSCRIPTION API ISSUES:"
echo "   - API service down/unresponsive"
echo "   - Network connectivity problems"
echo "   - API overloaded and timing out"
echo ""

echo "3. 💾 RESOURCE EXHAUSTION:"
echo "   - Redis memory full"
echo "   - Disk space full"
echo "   - CPU/Memory overload"
echo ""

echo "4. 🐛 WORKER CRASHES:"
echo "   - Transcription workers crashed"
echo "   - Jobs stuck in processing state"
echo "   - Need to restart workers"
echo ""

echo "🎯 EXPECTED FINDINGS:"
echo "===================="
echo "❌ Large number in 'waiting' queue (thousands)"
echo "❌ Many jobs in 'failed' queue"
echo "❌ Transcription API not responding"
echo "❌ High memory/CPU usage"
echo "❌ Worker processes crashed"
echo ""

echo "🚀 IMMEDIATE ACTIONS NEEDED:"
echo "==========================="
echo "1. 🔄 RESTART TRANSCRIPTION WORKERS:"
echo "   docker restart app"
echo ""

echo "2. 🧹 CLEAR STUCK JOBS (if needed):"
echo "   docker exec -it redis redis-cli"
echo "   DEL bull:transcription-processing:waiting"
echo "   DEL bull:transcription-processing:failed"
echo ""

echo "3. 🔧 CHECK/RESTART TRANSCRIPTION API:"
echo "   # Check if API service is running"
echo "   # Restart if needed"
echo ""

echo "4. 📊 MONITOR RECOVERY:"
echo "   # Watch queue lengths decrease"
echo "   # Monitor transcription completion rate"
echo ""

echo "⚠️  CRITICAL NOTES:"
echo "==================="
echo "1. This is a PRODUCTION EMERGENCY - 3,325 calls stuck!"
echo "2. Queue processing completely stopped for 1404-07-08"
echo "3. Need immediate intervention to restore service"
echo "4. May need to process in smaller batches"
echo ""

echo "Run these commands on your PRODUCTION server immediately!"

