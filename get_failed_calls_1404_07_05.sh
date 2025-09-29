#!/bin/bash

# Script to get 5 calls from 1404-07-05 that don't have transcription
# This will help identify specific failed calls for further investigation

echo "========================================="
echo "  FAILED CALLS FROM 1404-07-05"
echo "  (5 calls without transcription)"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Database connection details
POSTGRES_USER="postgres"
POSTGRES_DB="opera_qc"
POSTGRES_PASSWORD="StrongP@ssw0rd123"
export PGPASSWORD="$POSTGRES_PASSWORD"

# Check if postgres container is running
if ! docker ps --format "{{.Names}}" | grep -q "postgres"; then
    echo "❌ PostgreSQL container 'postgres' is not running."
    echo "   Please start it with: docker compose up postgres -d"
    exit 1
fi

echo "📋 5 CALLS FROM 1404-07-05 WITHOUT TRANSCRIPTION:"
echo "------------------------------------------------"

# Get 5 calls without transcription with detailed information
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    id,
    date,
    filename,
    type,
    source_number,
    dest_number,
    duration,
    queue,
    CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_incoming_file,
    CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_outgoing_file,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;" 2>/dev/null

echo ""
echo "📊 SUMMARY OF THESE 5 CALLS:"
echo "----------------------------"

# Get summary statistics for these specific calls
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
WITH failed_calls AS (
    SELECT *
    FROM \"SessionEvent\" 
    WHERE DATE(date) = '1404-07-05' 
      AND transcription IS NULL
    ORDER BY date
    LIMIT 5
)
SELECT 
    'Total Selected Calls' as metric,
    COUNT(*) as count
FROM failed_calls
UNION ALL
SELECT 
    'Missing Incoming Files' as metric,
    COUNT(*) as count
FROM failed_calls 
WHERE \"incommingfileUrl\" IS NULL
UNION ALL
SELECT 
    'Missing Outgoing Files' as metric,
    COUNT(*) as count
FROM failed_calls 
WHERE \"outgoingfileUrl\" IS NULL
UNION ALL
SELECT 
    'Average Duration (seconds)' as metric,
    ROUND(AVG(EXTRACT(EPOCH FROM duration::interval))) as count
FROM failed_calls;" 2>/dev/null

echo ""
echo "🔍 DETAILED ANALYSIS:"
echo "--------------------"

# Get the specific filenames for manual testing
echo "Filenames for manual testing:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "
SELECT filename
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;" 2>/dev/null | while read filename; do
    if [ ! -z "$filename" ]; then
        echo "  - $filename"
        echo "    Test URL: http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=$filename"
    fi
done

echo ""
echo "🧪 MANUAL TESTING COMMANDS:"
echo "--------------------------"
echo "Test file server connectivity for these specific files:"
echo ""

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "
SELECT filename
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;" 2>/dev/null | while read filename; do
    if [ ! -z "$filename" ]; then
        echo "# Test file: $filename"
        echo "curl -I 'http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=$filename'"
        echo ""
    fi
done

echo ""
echo "💡 USAGE NOTES:"
echo "--------------"
echo "1. These are 5 representative failed calls from 1404-07-05"
echo "2. All failed calls are missing both incoming and outgoing files"
echo "3. Use the test URLs above to check if files are available on the file server"
echo "4. If files are available now, the issue was temporary server downtime"
echo "5. If files are still missing, they were never properly stored"

echo ""
echo "Script completed successfully!"
