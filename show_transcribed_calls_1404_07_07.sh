#!/bin/bash

# Script to show transcribed calls from 1404-07-07
# This will display the 20 transcribed calls with their details

echo "========================================="
echo "    TRANSCRIBED CALLS FROM 1404-07-07"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Set PostgreSQL password
export PGPASSWORD='StrongP@ssw0rd123'

echo "📊 TRANSCRIBED CALLS DETAILS:"
echo "---------------------------------------------"

# Get transcribed calls from 1404-07-07
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c "
SELECT 
    id as session_id,
    filename,
    CASE 
        WHEN transcription IS NOT NULL THEN '✅ Transcribed'
        ELSE '❌ Not Transcribed'
    END as transcription_status,
    "incommingfileUrl",
    "outgoingfileUrl",
    date,
    EXTRACT(HOUR FROM date) as hour
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-07' 
    AND transcription IS NOT NULL
ORDER BY date ASC;
"

echo ""
echo "📈 SUMMARY:"
echo "---------------------------------------------"

# Get summary statistics
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c "
SELECT 
    COUNT(*) as total_transcribed,
    COUNT(CASE WHEN "incommingfileUrl" IS NOT NULL THEN 1 END) as with_incoming_url,
    COUNT(CASE WHEN "outgoingfileUrl" IS NOT NULL THEN 1 END) as with_outgoing_url,
    COUNT(CASE WHEN "incommingfileUrl" IS NOT NULL AND "outgoingfileUrl" IS NOT NULL THEN 1 END) as with_both_urls,
    MIN(EXTRACT(HOUR FROM date)) as earliest_hour,
    MAX(EXTRACT(HOUR FROM date)) as latest_hour
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-07' 
    AND transcription IS NOT NULL;
"

echo ""
echo "🕐 HOURLY BREAKDOWN:"
echo "---------------------------------------------"

# Get hourly breakdown
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c "
SELECT 
    EXTRACT(HOUR FROM date) as hour,
    COUNT(*) as transcribed_calls
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-07' 
    AND transcription IS NOT NULL
GROUP BY EXTRACT(HOUR FROM date)
ORDER BY hour;
"

echo ""
echo "🔍 SAMPLE TRANSCRIPTION DATA:"
echo "---------------------------------------------"

# Get a sample of transcription data (first 3 calls)
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c "
SELECT 
    id as session_id,
    filename,
    jsonb_pretty(transcription) as transcription_json
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-07' 
    AND transcription IS NOT NULL
ORDER BY date ASC
LIMIT 3;
"

echo ""
echo "✅ Script completed successfully!"
