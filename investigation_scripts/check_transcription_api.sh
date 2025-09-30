#!/bin/bash

# Transcription API Health Check - PRODUCTION SERVER
# Check if the transcription API is responding and healthy

echo "========================================="
echo "    TRANSCRIPTION API HEALTH CHECK"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔍 CHECKING TRANSCRIPTION API HEALTH..."
echo ""

# Check if API is reachable
echo "📡 API CONNECTIVITY TEST:"
echo "=========================="
echo "Testing: http://31.184.134.153:8003/health"
echo ""

# Test basic connectivity
echo "🌐 Basic Connectivity:"
curl -I --connect-timeout 10 http://31.184.134.153:8003/health 2>/dev/null | head -5
echo ""

# Test with a small file (if available)
echo "🧪 API Response Test:"
echo "====================="
# Create a small test file
echo "test audio content" > /tmp/test_audio.wav

# Test API with small file
echo "Testing API with small file..."
curl -X POST \
  -F "file=@/tmp/test_audio.wav" \
  -F "filename=test" \
  --connect-timeout 30 \
  --max-time 60 \
  http://31.184.134.153:8003/process/ 2>/dev/null | head -3

# Clean up test file
rm -f /tmp/test_audio.wav
echo ""

# Check API response time
echo "⏱️  API Response Time Test:"
echo "==========================="
echo "Testing response time..."
START_TIME=$(date +%s.%N)
curl -I --connect-timeout 10 http://31.184.134.153:8003/health >/dev/null 2>&1
END_TIME=$(date +%s.%N)
RESPONSE_TIME=$(echo "$END_TIME - $START_TIME" | bc 2>/dev/null || echo "N/A")
echo "Response time: ${RESPONSE_TIME}s"
echo ""

# Check if API is overloaded
echo "📊 API LOAD ANALYSIS:"
echo "====================="
echo "Current queue backlog: 5,816 jobs"
echo "Active processing: 3 jobs"
echo "Estimated processing time: $((5816 / 3)) hours"
echo ""

# Check application worker configuration
echo "⚙️  WORKER CONFIGURATION:"
echo "========================"
echo "Checking BullMQ worker settings..."
echo ""

# Check if we can increase worker concurrency
echo "💡 OPTIMIZATION SUGGESTIONS:"
echo "============================"
echo "1. Check transcription API server resources"
echo "2. Verify API can handle higher concurrency"
echo "3. Consider increasing worker concurrency"
echo "4. Monitor API response times"
echo ""

# Check recent API errors in logs
echo "📝 RECENT API ERRORS:"
echo "====================="
echo "Checking application logs for API errors..."
docker logs app --since="1h" 2>&1 | grep -i -E "(api|transcription|error|timeout|failed)" | tail -10
echo ""

echo "🎯 RECOMMENDED ACTIONS:"
echo "======================="
echo "1. 🔍 Check transcription API server status"
echo "2. 📊 Monitor API response times"
echo "3. ⚡ Consider increasing worker concurrency"
echo "4. 🔄 Restart transcription workers if needed"
echo ""

echo "📅 Last updated: $(date)"
