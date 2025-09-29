#!/bin/bash

# Script to extract and test URLs for failed calls from 1404-07-05
# This will verify if the URLs in the database are working

echo "========================================="
echo "  TESTING FAILED CALLS URLs"
echo "  Date: 1404-07-05"
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

echo "📋 EXTRACTING URLs FROM FAILED CALLS:"
echo "------------------------------------"

# Get URLs from failed calls
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    id,
    filename,
    \"incommingfileUrl\",
    \"outgoingfileUrl\",
    CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 'HAS_URL' ELSE 'NO_URL' END as incoming_status,
    CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 'HAS_URL' ELSE 'NO_URL' END as outgoing_status
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 10;" 2>/dev/null

echo ""
echo "🔍 TESTING FILE SERVER URLs (if they exist):"
echo "-------------------------------------------"

# Test the actual file server URLs that should work
echo "Testing file server URLs for failed calls:"
echo ""

# Get the first 5 failed filenames and test their URLs
FAILED_FILES=$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -c "
SELECT filename
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;" 2>/dev/null)

echo "Testing file server URLs for these files:"
echo "$FAILED_FILES"
echo ""

# Test each file
echo "$FAILED_FILES" | while read -r filename; do
    if [ ! -z "$filename" ]; then
        echo "=== Testing file: $filename ==="
        
        # Test incoming file
        echo "Testing incoming file (-in):"
        curl -I --user 'Tipax:Goz@r!SimotelTip@x!1404' "http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=${filename}-in" 2>/dev/null | head -5
        
        # Test outgoing file  
        echo "Testing outgoing file (-out):"
        curl -I --user 'Tipax:Goz@r!SimotelTip@x!1404' "http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=${filename}-out" 2>/dev/null | head -5
        
        echo ""
    fi
done

echo "📊 COMPARISON WITH SUCCESSFUL CALLS:"
echo "-----------------------------------"

# Get URLs from successful calls for comparison
echo "URLs from successful calls (hour 7):"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    id,
    filename,
    \"incommingfileUrl\",
    \"outgoingfileUrl\",
    CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 'HAS_URL' ELSE 'NO_URL' END as incoming_status,
    CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 'HAS_URL' ELSE 'NO_URL' END as outgoing_status
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NOT NULL
  AND EXTRACT(HOUR FROM date) = 7
ORDER BY date
LIMIT 3;" 2>/dev/null

echo ""
echo "🧪 MANUAL TESTING COMMANDS:"
echo "--------------------------"

echo "Test these specific failed files manually:"
echo "$FAILED_FILES" | while read -r filename; do
    if [ ! -z "$filename" ]; then
        echo "# Test file: $filename"
        echo "curl -I --user 'Tipax:Goz@r!SimotelTip@x!1404' 'http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=${filename}-in'"
        echo "curl -I --user 'Tipax:Goz@r!SimotelTip@x!1404' 'http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=${filename}-out'"
        echo ""
    fi
done

echo "🎯 EXPECTED RESULTS:"
echo "-------------------"
echo ""
echo "✅ If URLs in database are NULL:"
echo "   - File server URLs should work (HTTP 200)"
echo "   - This confirms application bug in URL saving"
echo ""
echo "❌ If URLs in database exist but don't work:"
echo "   - MinIO URLs might be broken/expired"
echo "   - File server URLs should still work"
echo ""
echo "🔍 This will help identify:"
echo "   1. Whether URLs were saved to database"
echo "   2. Whether the saved URLs are working"
echo "   3. Whether file server URLs are working"
echo "   4. The exact point of failure in the process"

echo ""
echo "Script completed!"
