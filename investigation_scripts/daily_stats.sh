#!/bin/bash

# Daily Session Statistics Script
echo "========================================="
echo "    Daily Session Statistics"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "📊 SESSIONS PER DAY (Last 30 days):"
echo "-----------------------------------"

docker exec -it postgres psql -U postgres -d opera_qc -c "
SELECT 
    DATE(date) as day,
    COUNT(*) as total,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming,
    COUNT(CASE WHEN type = 'outgoing' THEN 1 END) as outgoing,
    COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) as transcribed,
    ROUND(COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as transcribed_percent
FROM \"SessionEvent\" 
GROUP BY DATE(date) 
ORDER BY day DESC 
LIMIT 30;" | cat

echo ""
echo "📈 WEEKLY SUMMARY:"
echo "-----------------"

docker exec -it postgres psql -U postgres -d opera_qc -c "
SELECT 
    DATE_TRUNC('week', date) as week_start,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming_sessions,
    AVG(COUNT(*)) OVER() as avg_per_week
FROM \"SessionEvent\" 
WHERE date >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY DATE_TRUNC('week', date)
ORDER BY week_start DESC;" | cat

echo ""
echo "🕒 TODAY'S HOURLY BREAKDOWN:"
echo "---------------------------"

docker exec -it postgres psql -U postgres -d opera_qc -c "
SELECT 
    EXTRACT(HOUR FROM date) as hour,
    COUNT(*) as sessions,
    COUNT(CASE WHEN type = 'incoming' THEN 1 END) as incoming
FROM \"SessionEvent\" 
WHERE DATE(date) = CURRENT_DATE
GROUP BY EXTRACT(HOUR FROM date)
ORDER BY hour DESC;" | cat

echo ""
echo "========================================="
