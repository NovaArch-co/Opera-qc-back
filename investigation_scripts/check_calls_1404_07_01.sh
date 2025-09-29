#!/bin/bash

echo "========================================="
echo "    CHECKING CALLS FOR 01-07-1404"
echo "========================================="
echo "Generated at: $(date)"
echo ""

export PGPASSWORD="StrongP@ssw0rd123"

# First, let's understand the date format in the database
echo "🔍 ANALYZING DATE FORMATS IN DATABASE:"
echo "-------------------------------------"

echo "Sample of recent dates in database:"
docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    date,
    filename,
    CASE WHEN transcription IS NOT NULL THEN 'Yes' ELSE 'No' END as has_transcription
FROM \"SessionEvent\" 
ORDER BY date DESC 
LIMIT 5;" 2>/dev/null

echo ""
echo "🗓️ SEARCHING FOR CALLS ON 01-07-1404:"
echo "-------------------------------------"

# Persian date 01-07-1404 could be interpreted as:
# - Day 1, Month 7 (Mehr), Year 1404 Persian
# - This would be around September 23, 2025 in Gregorian calendar

echo "Searching by filename patterns (Persian date format)..."

# Search for filenames that start with 14040701 (YYYYMMDD format)
echo ""
echo "1. Searching for filenames starting with '14040701':"
RESULT1=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    id,
    date,
    filename,
    type,
    source_number,
    dest_number,
    duration,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription,
    CASE WHEN explanation IS NOT NULL THEN 'YES' ELSE 'NO' END as has_explanation,
    CASE WHEN category IS NOT NULL THEN category ELSE 'N/A' END as category,
    CASE WHEN emotion IS NOT NULL THEN emotion ELSE 'N/A' END as emotion
FROM \"SessionEvent\" 
WHERE filename LIKE '14040701%'
ORDER BY date DESC;" 2>/dev/null)

if [ ! -z "$RESULT1" ]; then
    echo "$RESULT1"
else
    echo "No calls found with filename pattern '14040701%'"
fi

echo ""
echo "2. Searching for filenames starting with '14040107':"
RESULT2=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    id,
    date,
    filename,
    type,
    source_number,
    dest_number,
    duration,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription,
    CASE WHEN explanation IS NOT NULL THEN 'YES' ELSE 'NO' END as has_explanation,
    CASE WHEN category IS NOT NULL THEN category ELSE 'N/A' END as category,
    CASE WHEN emotion IS NOT NULL THEN emotion ELSE 'N/A' END as emotion
FROM \"SessionEvent\" 
WHERE filename LIKE '14040107%'
ORDER BY date DESC;" 2>/dev/null)

if [ ! -z "$RESULT2" ]; then
    echo "$RESULT2"
else
    echo "No calls found with filename pattern '14040107%'"
fi

echo ""
echo "3. Searching for any filename containing '140407' or '140401':"
RESULT3=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    id,
    date,
    filename,
    type,
    source_number,
    dest_number,
    duration,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription
FROM \"SessionEvent\" 
WHERE filename LIKE '%140407%' OR filename LIKE '%140401%'
ORDER BY date DESC
LIMIT 20;" 2>/dev/null)

if [ ! -z "$RESULT3" ]; then
    echo "$RESULT3"
else
    echo "No calls found with patterns containing '140407' or '140401'"
fi

echo ""
echo "📊 TRANSCRIPTION ANALYSIS FOR FOUND CALLS:"
echo "-----------------------------------------"

# If we found any calls, let's get detailed transcription info
TRANSCRIPTION_DETAILS=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    id,
    filename,
    CASE 
        WHEN transcription IS NOT NULL THEN 
            CASE 
                WHEN LENGTH(transcription::text) > 100 THEN 
                    SUBSTRING(transcription::text, 1, 100) || '...'
                ELSE 
                    transcription::text
            END
        ELSE 'No transcription'
    END as transcription_preview
FROM \"SessionEvent\" 
WHERE (filename LIKE '14040701%' OR filename LIKE '14040107%' OR filename LIKE '%140407%' OR filename LIKE '%140401%')
ORDER BY date DESC;" 2>/dev/null)

if [ ! -z "$TRANSCRIPTION_DETAILS" ]; then
    echo "$TRANSCRIPTION_DETAILS"
else
    echo "No transcription details found for the searched patterns"
fi

echo ""
echo "🔍 ALTERNATIVE SEARCH - RECENT CALLS AROUND THAT TIMEFRAME:"
echo "----------------------------------------------------------"

# Let's also check for calls in a broader timeframe
echo "Checking calls from filename patterns 1404070* and 1404010*:"
BROADER_SEARCH=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    id,
    date,
    filename,
    type,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription
FROM \"SessionEvent\" 
WHERE filename LIKE '1404070%' OR filename LIKE '1404010%'
ORDER BY filename DESC
LIMIT 10;" 2>/dev/null)

if [ ! -z "$BROADER_SEARCH" ]; then
    echo "$BROADER_SEARCH"
else
    echo "No calls found in broader search patterns"
fi

echo ""
echo "📈 SUMMARY:"
echo "----------"

# Count total calls found
TOTAL_FOUND=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
SELECT COUNT(*) FROM \"SessionEvent\" 
WHERE filename LIKE '14040701%' OR filename LIKE '14040107%' OR filename LIKE '%140407%' OR filename LIKE '%140401%';" 2>/dev/null)

TRANSCRIBED_FOUND=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
SELECT COUNT(*) FROM \"SessionEvent\" 
WHERE (filename LIKE '14040701%' OR filename LIKE '14040107%' OR filename LIKE '%140407%' OR filename LIKE '%140401%')
AND transcription IS NOT NULL;" 2>/dev/null)

echo "Total calls found for date patterns: $TOTAL_FOUND"
echo "Calls with transcription: $TRANSCRIBED_FOUND"

if [ ! -z "$TOTAL_FOUND" ] && [ "$TOTAL_FOUND" -gt 0 ] && [ ! -z "$TRANSCRIBED_FOUND" ]; then
    TRANSCRIPTION_RATE=$(echo "scale=1; $TRANSCRIBED_FOUND * 100 / $TOTAL_FOUND" | bc -l 2>/dev/null || echo "N/A")
    echo "Transcription rate for found calls: $TRANSCRIPTION_RATE%"
fi

echo ""
echo "========================================="
