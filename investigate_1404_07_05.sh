#!/bin/bash

# Investigation Script for 1404-07-05 Low Transcription Rate
# This script helps investigate the root cause of low transcription rate

echo "========================================="
echo "  INVESTIGATING 1404-07-05 TRANSCRIPTION"
echo "  Low Rate: 1,385/9,790 (14.15%)"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Database connection details (adjust if needed)
POSTGRES_USER="postgres"
POSTGRES_DB="opera_qc"
POSTGRES_PASSWORD="StrongP@ssw0rd123"
export PGPASSWORD="$POSTGRES_PASSWORD"

# Transcription API endpoint
TRANSCRIPTION_API="http://31.184.134.153:8003"

echo "🔍 STEP 1: CHECK TRANSCRIPTION API SERVICE"
echo "----------------------------------------"

# Test if transcription API is currently accessible
echo "Testing transcription API connectivity..."
if curl -s --connect-timeout 5 "$TRANSCRIPTION_API" > /dev/null 2>&1; then
    echo "✅ Transcription API is currently accessible"
else
    echo "❌ Transcription API is currently NOT accessible"
    echo "   This could indicate the same issue occurred on 1404-07-05"
fi

# Try to get API status/health
echo ""
echo "Checking API endpoints..."
for endpoint in "/health" "/status" "/ping" ""; do
    url="$TRANSCRIPTION_API$endpoint"
    response=$(curl -s -w "%{http_code}" --connect-timeout 5 "$url" 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo "✅ $url - Response: $response"
    else
        echo "❌ $url - No response"
    fi
done

echo ""
echo "🗄️  STEP 2: DATABASE ANALYSIS FOR 1404-07-05"
echo "--------------------------------------------"

# Check if postgres container is running
if ! docker ps --format "{{.Names}}" | grep -q "postgres"; then
    echo "❌ PostgreSQL container 'postgres' is not running."
    echo "   Cannot perform database analysis."
    echo ""
    echo "🔧 To start PostgreSQL:"
    echo "   docker compose up postgres -d"
    exit 1
fi

echo "📊 Basic Statistics:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    'Total Calls' as metric,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05'
UNION ALL
SELECT 
    'Transcribed Calls' as metric,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' AND transcription IS NOT NULL
UNION ALL
SELECT 
    'Failed Transcriptions' as metric,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' AND transcription IS NULL;" 2>/dev/null

echo ""
echo "📂 File Availability Analysis:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    'Missing Incoming Files' as issue,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL 
  AND \"incommingfileUrl\" IS NULL
UNION ALL
SELECT 
    'Missing Outgoing Files' as issue,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL 
  AND \"outgoingfileUrl\" IS NULL
UNION ALL
SELECT 
    'Missing Both Files' as issue,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL 
  AND (\"incommingfileUrl\" IS NULL OR \"outgoingfileUrl\" IS NULL);" 2>/dev/null

echo ""
echo "⏰ Hourly Failure Pattern:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    EXTRACT(HOUR FROM date) as hour,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed,
    COUNT(CASE WHEN transcription IS NULL THEN 1 END) as failed,
    ROUND(COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as success_rate
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05'
GROUP BY EXTRACT(HOUR FROM date)
ORDER BY hour;" 2>/dev/null

echo ""
echo "🔍 STEP 3: COMPARISON WITH SUCCESSFUL DATE"
echo "-----------------------------------------"

echo "Comparing with 1404-06-29 (high success rate):"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    DATE(date) as call_date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed,
    ROUND(COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate,
    COUNT(CASE WHEN \"incommingfileUrl\" IS NULL THEN 1 END) as missing_incoming,
    COUNT(CASE WHEN \"outgoingfileUrl\" IS NULL THEN 1 END) as missing_outgoing
FROM \"SessionEvent\" 
WHERE DATE(date) IN ('1404-07-05', '1404-06-29')
GROUP BY DATE(date)
ORDER BY DATE(date);" 2>/dev/null

echo ""
echo "📋 STEP 4: SAMPLE FAILED TRANSCRIPTIONS"
echo "--------------------------------------"

echo "Sample of calls that failed transcription:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    id,
    EXTRACT(HOUR FROM date) as hour,
    filename,
    duration,
    CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_incoming,
    CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_outgoing
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 10;" 2>/dev/null

echo ""
echo "🎯 STEP 5: LOAD ANALYSIS"
echo "-----------------------"

echo "Call volume by hour (to identify peak load times):"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    EXTRACT(HOUR FROM date) as hour,
    COUNT(*) as calls_per_hour,
    CASE 
        WHEN COUNT(*) > 500 THEN 'HIGH LOAD'
        WHEN COUNT(*) > 200 THEN 'MEDIUM LOAD'
        ELSE 'LOW LOAD'
    END as load_level
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05'
GROUP BY EXTRACT(HOUR FROM date)
ORDER BY COUNT(*) DESC;" 2>/dev/null

echo ""
echo "📊 SUMMARY & RECOMMENDATIONS"
echo "============================"

# Calculate some key metrics
TOTAL_CALLS=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE DATE(date) = '1404-07-05';" 2>/dev/null)
TRANSCRIBED_CALLS=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE DATE(date) = '1404-07-05' AND transcription IS NOT NULL;" 2>/dev/null)
MISSING_FILES=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE DATE(date) = '1404-07-05' AND transcription IS NULL AND (\"incommingfileUrl\" IS NULL OR \"outgoingfileUrl\" IS NULL);" 2>/dev/null)

echo "📈 Key Metrics:"
echo "  Total Calls: $TOTAL_CALLS"
echo "  Transcribed: $TRANSCRIBED_CALLS"
echo "  Missing Files: $MISSING_FILES"

if [ ! -z "$TOTAL_CALLS" ] && [ "$TOTAL_CALLS" -gt 0 ]; then
    FAILURE_RATE=$(echo "scale=1; ($TOTAL_CALLS - $TRANSCRIBED_CALLS) * 100 / $TOTAL_CALLS" | bc -l 2>/dev/null)
    echo "  Failure Rate: $FAILURE_RATE%"
fi

echo ""
echo "🔧 LIKELY ROOT CAUSES (in order of probability):"
echo "1. Transcription API Service Overload/Downtime"
echo "   - High call volume (9,790 calls) exceeded service capacity"
echo "   - Service may have crashed or become unresponsive"
echo ""
echo "2. File System Issues"
echo "   - Audio files not properly downloaded or stored"
echo "   - Check MinIO storage and file server connectivity"
echo ""
echo "3. Queue/Worker Issues"
echo "   - Redis queue overflow or worker crashes"
echo "   - Only 3 concurrent workers for high load"
echo ""
echo "🚀 IMMEDIATE ACTIONS:"
echo "1. Check transcription API service logs for 1404-07-05"
echo "2. Verify MinIO storage and file availability"
echo "3. Check Redis queue status and failed jobs"
echo "4. Consider increasing transcription worker concurrency"
echo ""
echo "📋 MONITORING RECOMMENDATIONS:"
echo "1. Add health checks for transcription API"
echo "2. Monitor queue depth and processing rates"
echo "3. Set up alerts for transcription rate drops"
echo "4. Implement auto-scaling for high load periods"

echo ""
echo "Investigation complete! Check the analysis above for insights."
