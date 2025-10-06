#!/bin/bash

# Database connection details
POSTGRES_USER="postgres"
POSTGRES_DB="opera_qc"
POSTGRES_PASSWORD="StrongP@ssw0rd123"

echo "========================================="
echo "    PERSIAN DATE DATABASE STATISTICS"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Export password for psql
export PGPASSWORD="$POSTGRES_PASSWORD"

# Check if postgres container is running
if ! docker ps --format "{{.Names}}" | grep -q "postgres"; then
    echo "Error: PostgreSQL container 'postgres' is not running."
    exit 1
fi

echo "📊 RECENT DATABASE RECORDS (Persian Calendar):"
echo "---------------------------------------------"

# Get records for the last few Persian dates
echo "Recent Persian dates with activity:"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    DATE(date) as persian_date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming,
    COUNT(CASE WHEN type = 'outgoing' THEN 1 END) as outgoing,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed
FROM \"SessionEvent\" 
WHERE date >= '1404-06-20'
GROUP BY DATE(date) 
ORDER BY DATE(date) DESC
LIMIT 15;" 2>/dev/null

echo ""
echo "📈 PERSIAN DATE BREAKDOWN (1404-06-22 to 1404-06-30):"
echo "----------------------------------------------------"

# Specific date range that the client mentioned
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    DATE(date) as call_date,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming_calls,
    COUNT(CASE WHEN type = 'outgoing' THEN 1 END) as outgoing_calls,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed_calls,
    ROUND(COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as transcription_rate
FROM \"SessionEvent\" 
WHERE date >= '1404-06-22 00:00:00' AND date <= '1404-06-30 23:59:59'
GROUP BY DATE(date) 
ORDER BY DATE(date) DESC;" 2>/dev/null

echo ""
echo "🎯 CLIENT'S SPECIFIC TIMEFRAME (1404-06-22 22 Shahrivar to 1404-06-23 01:00):"
echo "--------------------------------------------------------------------------"

# The exact timeframe the client mentioned
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    COUNT(*) as total_calls_in_timeframe,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming_calls,
    COUNT(CASE WHEN type = 'outgoing' THEN 1 END) as outgoing_calls,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed_calls,
    ROUND(COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as transcription_rate
FROM \"SessionEvent\" 
WHERE date >= '1404-06-22 00:00:00' AND date < '1404-06-23 01:00:00';" 2>/dev/null

echo ""
echo "📞 HOURLY BREAKDOWN for 1404-06-22 (22 Shahrivar):"
echo "-------------------------------------------------"

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    EXTRACT(HOUR FROM date) as hour,
    COUNT(*) as calls_count,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-06-22'
GROUP BY EXTRACT(HOUR FROM date)
ORDER BY hour;" 2>/dev/null

echo ""
echo "🕒 MOST RECENT CALLS (Last 15):"
echo "-------------------------------"

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    date as call_time,
    type,
    source_number,
    dest_number,
    CASE WHEN transcription IS NOT NULL THEN 'Yes' ELSE 'No' END as transcribed,
    CASE 
        WHEN transcription IS NOT NULL THEN 'Completed'
        ELSE 'Pending'
    END as status
FROM \"SessionEvent\" 
ORDER BY date DESC 
LIMIT 15;" 2>/dev/null

echo ""
echo "========================================="
