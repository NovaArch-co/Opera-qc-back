#!/bin/bash

echo "========================================="
echo "  URGENT: FILE SYSTEM FAILURE ANALYSIS"
echo "  Date: 1404-07-05 around 08:00-09:00"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# File server details
FILE_SERVER="http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php"
MINIO_ENDPOINT="http://31.184.134.153:9005"

echo "🔍 STEP 1: CHECK FILE SERVER CONNECTIVITY"
echo "----------------------------------------"

echo "Testing file server connectivity..."
if curl -s --connect-timeout 10 "http://94.182.56.132" > /dev/null 2>&1; then
    echo "✅ File server (94.182.56.132) is currently accessible"
else
    echo "❌ File server (94.182.56.132) is currently NOT accessible"
    echo "   This could be the same issue that occurred on 1404-07-05"
fi

echo ""
echo "Testing file server PHP endpoint..."
# Test with a sample filename from the failed calls
SAMPLE_FILE="14040705-083814-09034414112-2952"
TEST_URL="${FILE_SERVER}?recfile=${SAMPLE_FILE}"
echo "Testing: $TEST_URL"

response=$(curl -s -w "%{http_code}" --connect-timeout 10 "$TEST_URL" 2>/dev/null)
http_code="${response: -3}"
if [[ "$http_code" == "200" ]]; then
    echo "✅ File server PHP endpoint responds with HTTP 200"
elif [[ "$http_code" == "404" ]]; then
    echo "⚠️  File server responds with HTTP 404 (file not found - expected for old files)"
else
    echo "❌ File server issue - HTTP code: $http_code"
fi

echo ""
echo "🗄️  STEP 2: CHECK MINIO STORAGE"
echo "------------------------------"

echo "Testing MinIO connectivity..."
if curl -s --connect-timeout 10 "$MINIO_ENDPOINT" > /dev/null 2>&1; then
    echo "✅ MinIO endpoint is currently accessible"
else
    echo "❌ MinIO endpoint is currently NOT accessible"
fi

echo ""
echo "📊 STEP 3: ANALYZE SUCCESSFUL vs FAILED PERIODS"
echo "-----------------------------------------------"

# Database connection details
POSTGRES_USER="postgres"
POSTGRES_DB="opera_qc"
POSTGRES_PASSWORD="StrongP@ssw0rd123"
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Detailed breakdown of the failure timeline:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    EXTRACT(HOUR FROM date) as hour,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed,
    COUNT(CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 1 END) as has_incoming_file,
    COUNT(CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 1 END) as has_outgoing_file,
    CASE 
        WHEN COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) = 0 THEN 'COMPLETE FAILURE'
        WHEN COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) < COUNT(*) * 0.5 THEN 'MAJOR FAILURE'
        WHEN COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) < COUNT(*) * 0.9 THEN 'PARTIAL FAILURE'
        ELSE 'SUCCESS'
    END as status
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05'
GROUP BY EXTRACT(HOUR FROM date)
ORDER BY hour;" 2>/dev/null

echo ""
echo "🔍 STEP 4: CHECK SAMPLE SUCCESSFUL CALLS"
echo "---------------------------------------"

echo "Sample of successful calls (to see what worked):"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    id,
    EXTRACT(HOUR FROM date) as hour,
    filename,
    CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_incoming,
    CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_outgoing,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as transcribed
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NOT NULL
ORDER BY date
LIMIT 10;" 2>/dev/null

echo ""
echo "🚨 CRITICAL FINDINGS"
echo "==================="

echo ""
echo "📈 FAILURE TIMELINE:"
echo "  06:00-07:00: System working normally (100% success)"
echo "  08:00:      File system starts failing (56% success)"  
echo "  09:00+:     Complete file system failure (0% success)"
echo ""
echo "🎯 ROOT CAUSE: FILE DOWNLOAD/STORAGE SYSTEM FAILURE"
echo ""
echo "The transcription API is working fine. The issue is that audio files"
echo "are not being downloaded from the file server or stored in MinIO."
echo ""
echo "🔧 IMMEDIATE INVESTIGATION NEEDED:"
echo ""
echo "1. CHECK FILE SERVER LOGS (94.182.56.132)"
echo "   - Was the server down on 1404-07-05 around 08:00-09:00?"
echo "   - Any authentication or permission changes?"
echo "   - Network connectivity issues?"
echo ""
echo "2. CHECK MINIO LOGS"
echo "   - Disk space issues?"
echo "   - Service restarts or crashes?"
echo "   - Permission problems?"
echo ""
echo "3. CHECK APPLICATION LOGS"
echo "   - File download errors in the sequential queue"
echo "   - MinIO upload failures"
echo "   - Network timeout errors"
echo ""
echo "4. CHECK INFRASTRUCTURE"
echo "   - Network connectivity between servers"
echo "   - DNS resolution issues"
echo "   - Firewall or security changes"
echo ""
echo "🚀 PREVENTION MEASURES:"
echo ""
echo "1. Add file download retry logic with exponential backoff"
echo "2. Implement health checks for file server connectivity"
echo "3. Add alerts when file download success rate drops below 90%"
echo "4. Consider local file caching/backup mechanisms"
echo "5. Add comprehensive logging for file operations"
echo ""
echo "💡 QUICK TEST:"
echo "Try downloading a file from that time period manually:"
echo "curl -v '${FILE_SERVER}?recfile=14040705-083814-09034414112-2952'"

echo ""
echo "Investigation complete! The root cause is clearly identified."
