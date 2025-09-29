#!/bin/bash

# Fix 2: Diagnose and Fix Transcription Queue Issues
# This identifies why transcription jobs are failing

echo "========================================="
echo "  FIX 2: TRANSCRIPTION QUEUE DIAGNOSIS"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔧 PROBLEM IDENTIFIED:"
echo "  - Files downloaded and uploaded to MinIO ✅"
echo "  - Transcription jobs queued ✅"
echo "  - But transcription jobs are failing ❌"
echo "  - URLs never saved because transcription fails ❌"
echo ""

echo "🔍 DIAGNOSIS COMMANDS:"
echo "======================"
echo ""

echo "# 1. Check transcription queue status"
echo "docker exec -it redis redis-cli"
echo "LLEN bull:transcription-processing:waiting"
echo "LLEN bull:transcription-processing:failed"
echo "LLEN bull:transcription-processing:completed"
echo ""

echo "# 2. Check failed transcription jobs"
echo "docker exec -it redis redis-cli"
echo "LRANGE bull:transcription-processing:failed 0 10"
echo ""

echo "# 3. Check transcription API health"
echo "curl -I 'http://31.184.134.153:8003/health'"
echo "curl -I 'http://31.184.134.153:8003/status'"
echo ""

echo "# 4. Test transcription API with a sample file"
echo "curl -X POST 'http://31.184.134.153:8003/process/' \\"
echo "  -F 'customer=@/tmp/test_customer.wav' \\"
echo "  -F 'agent=@/tmp/test_agent.wav'"
echo ""

echo "# 5. Check transcription worker logs"
echo "docker logs app 2>&1 | grep -i 'transcription.*fail\\|transcription.*error' | tail -20"
echo ""

echo "🔧 COMMON TRANSCRIPTION QUEUE ISSUES:"
echo "===================================="
echo ""

echo "1. TRANSCRIPTION API DOWN/UNRESPONSIVE"
echo "   - Check if http://31.184.134.153:8003 is accessible"
echo "   - Restart transcription API service"
echo "   - Check API logs for errors"
echo ""

echo "2. FILE PATH ISSUES"
echo "   - Check if temporary files exist"
echo "   - Verify file permissions"
echo "   - Check disk space"
echo ""

echo "3. NETWORK CONNECTIVITY"
echo "   - Check network between app and transcription API"
echo "   - Check firewall rules"
echo "   - Test with curl commands"
echo ""

echo "4. MEMORY/RESOURCE ISSUES"
echo "   - Check server memory usage"
echo "   - Check transcription API memory"
echo "   - Restart services if needed"
echo ""

echo "5. CONCURRENCY ISSUES"
echo "   - Too many concurrent transcription jobs"
echo "   - Reduce concurrency from 3 to 1"
echo "   - Add rate limiting"
echo ""

echo "🔧 QUICK FIXES TO TRY:"
echo "====================="
echo ""

echo "# Fix 1: Restart transcription API"
echo "docker restart transcription-api-container"
echo ""

echo "# Fix 2: Reduce transcription concurrency"
echo "# Edit src/queue/transcriptionQueue.ts"
echo "# Change: concurrency: 3"
echo "# To:    concurrency: 1"
echo ""

echo "# Fix 3: Add more retry attempts"
echo "# Edit src/queue/transcriptionQueue.ts"
echo "# Change: attempts: 3"
echo "# To:    attempts: 5"
echo ""

echo "# Fix 4: Increase timeout"
echo "# Add timeout configuration to transcription API calls"
echo ""

echo "🔧 MONITORING ADDITIONS:"
echo "======================="
echo ""

echo "Add these monitoring checks:"
echo ""
echo "1. HEALTH CHECK ENDPOINT"
echo "   - Add /health endpoint to check transcription API"
echo "   - Monitor every 5 minutes"
echo ""

echo "2. QUEUE MONITORING"
echo "   - Monitor queue depth"
echo "   - Alert when failed jobs > 10"
echo "   - Alert when queue depth > 100"
echo ""

echo "3. TRANSCRIPTION SUCCESS RATE"
echo "   - Monitor transcription success rate"
echo "   - Alert when success rate < 90%"
echo ""

echo "4. FILE VALIDATION"
echo "   - Check file sizes before sending to API"
echo "   - Validate file formats"
echo "   - Skip empty files"
echo ""

echo "🎯 EXPECTED RESULTS AFTER FIX:"
echo "============================="
echo "✅ Transcription jobs process successfully"
echo "✅ URLs saved to database after transcription"
echo "✅ High transcription success rate (>95%)"
echo "✅ Failed jobs retry automatically"
echo "✅ Monitoring alerts for issues"
echo ""

echo "🚀 NEXT STEPS:"
echo "=============="
echo "1. Run diagnosis commands above"
echo "2. Identify the specific transcription issue"
echo "3. Apply appropriate fixes"
echo "4. Test with new calls"
echo "5. Run retry_failed_transcriptions.sh for old calls"
echo ""

echo "Fix 2 completed! Run the diagnosis commands to identify the issue."
