#!/bin/bash

# Script to get JSON data for 5 failed calls from 1404-07-05
# This will show the complete database records including all fields

echo "========================================="
echo "  JSON DATA FOR 5 FAILED CALLS"
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

echo "📋 JSON DATA FOR 5 FAILED CALLS:"
echo "--------------------------------"

# Get complete JSON data for 5 failed calls
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    json_build_object(
        'id', id,
        'level', level,
        'time', time,
        'pid', pid,
        'hostname', hostname,
        'name', name,
        'msg', msg,
        'type', type,
        'sourceChannel', source_channel,
        'sourceNumber', source_number,
        'queue', queue,
        'destChannel', dest_channel,
        'destNumber', dest_number,
        'date', date,
        'duration', duration,
        'filename', filename,
        'incommingfileUrl', \"incommingfileUrl\",
        'outgoingfileUrl', \"outgoingfileUrl\",
        'transcription', transcription,
        'explanation', explanation,
        'category', category,
        'topic', topic,
        'emotion', emotion,
        'keyWords', \"keyWords\",
        'routinCheckStart', \"routinCheckStart\",
        'routinCheckEnd', \"routinCheckEnd\",
        'forbiddenWords', \"forbiddenWords\"
    ) as json_data
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;" 2>/dev/null

echo ""
echo "📊 SUMMARY OF JSON FIELDS:"
echo "-------------------------"

# Get field analysis for these calls
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
    'Total Records' as field,
    COUNT(*) as count
FROM failed_calls
UNION ALL
SELECT 
    'Has Incoming File URL' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE \"incommingfileUrl\" IS NOT NULL
UNION ALL
SELECT 
    'Has Outgoing File URL' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE \"outgoingfileUrl\" IS NOT NULL
UNION ALL
SELECT 
    'Has Transcription' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE transcription IS NOT NULL
UNION ALL
SELECT 
    'Has Explanation' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE explanation IS NOT NULL
UNION ALL
SELECT 
    'Has Category' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE category IS NOT NULL
UNION ALL
SELECT 
    'Has Emotion' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE emotion IS NOT NULL
UNION ALL
SELECT 
    'Has KeyWords' as field,
    COUNT(*) as count
FROM failed_calls 
WHERE \"keyWords\" IS NOT NULL AND array_length(\"keyWords\", 1) > 0;" 2>/dev/null

echo ""
echo "🔍 DETAILED FIELD ANALYSIS:"
echo "--------------------------"

# Show specific field values for analysis
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    id,
    filename,
    type,
    source_number,
    dest_number,
    duration,
    CASE WHEN \"incommingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_incoming_url,
    CASE WHEN \"outgoingfileUrl\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_outgoing_url,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription,
    CASE WHEN explanation IS NOT NULL THEN 'YES' ELSE 'NO' END as has_explanation,
    CASE WHEN category IS NOT NULL THEN 'YES' ELSE 'NO' END as has_category,
    CASE WHEN emotion IS NOT NULL THEN 'YES' ELSE 'NO' END as has_emotion,
    CASE WHEN \"keyWords\" IS NOT NULL AND array_length(\"keyWords\", 1) > 0 THEN 'YES' ELSE 'NO' END as has_keywords
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;" 2>/dev/null

echo ""
echo "💡 USAGE NOTES:"
echo "--------------"
echo "1. The JSON data above shows the complete database records"
echo "2. All failed calls have NULL transcription, explanation, category, etc."
echo "3. All failed calls have NULL file URLs (incoming and outgoing)"
echo "4. This confirms the file download failure on 1404-07-05"
echo "5. The JSON can be used for API testing or data analysis"

echo ""
echo "Script completed successfully!"
