#!/bin/bash

# Simple Database Daily Statistics
echo "========================================="
echo "    DATABASE DAILY STATISTICS"
echo "========================================="
echo "Generated at: $(date)"
echo ""

export PGPASSWORD="StrongP@ssw0rd123"

echo "📊 RECENT DATABASE RECORDS BY DATE:"
echo "-----------------------------------"

# Try a very simple query first
echo "Checking recent records..."
RECENT_COUNT=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE date >= '2025-09-15';" 2>/dev/null)

if [ ! -z "$RECENT_COUNT" ]; then
    echo "Records since 2025-09-15: $RECENT_COUNT"
else
    echo "Could not get recent count"
fi

echo ""
echo "📅 DAILY BREAKDOWN (Last 10 days):"
echo "-----------------------------------"

# Try manual date queries for recent days
for i in {0..9}; do
    TARGET_DATE=$(date -d "$i days ago" +%Y-%m-%d)
    
    COUNT=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
    SELECT COUNT(*) FROM \"SessionEvent\" 
    WHERE DATE(date) = '$TARGET_DATE';" 2>/dev/null)
    
    if [ ! -z "$COUNT" ] && [ "$COUNT" -gt 0 ]; then
        # Get breakdown by type
        INCOMING=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
        SELECT COUNT(*) FROM \"SessionEvent\" 
        WHERE DATE(date) = '$TARGET_DATE' AND type = 'incoming';" 2>/dev/null)
        
        OUTGOING=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
        SELECT COUNT(*) FROM \"SessionEvent\" 
        WHERE DATE(date) = '$TARGET_DATE' AND type = 'outgoing';" 2>/dev/null)
        
        TRANSCRIBED=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
        SELECT COUNT(*) FROM \"SessionEvent\" 
        WHERE DATE(date) = '$TARGET_DATE' AND transcription IS NOT NULL;" 2>/dev/null)
        
        printf "%-12s: %-5s total | %-5s incoming | %-5s outgoing | %-5s transcribed\n" \
               "$TARGET_DATE" "$COUNT" "$INCOMING" "$OUTGOING" "$TRANSCRIBED"
    fi
done

echo ""
echo "📈 TOTAL DATABASE SUMMARY:"
echo "-------------------------"

TOTAL=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\";" 2>/dev/null)
TOTAL_INCOMING=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE type = 'incoming';" 2>/dev/null)
TOTAL_OUTGOING=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE type = 'outgoing';" 2>/dev/null)
TOTAL_TRANSCRIBED=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\" WHERE transcription IS NOT NULL;" 2>/dev/null)

echo "Total records:           $TOTAL"
echo "Total incoming:          $TOTAL_INCOMING"
echo "Total outgoing:          $TOTAL_OUTGOING"
echo "Total transcribed:       $TOTAL_TRANSCRIBED"

if [ ! -z "$TOTAL" ] && [ "$TOTAL" -gt 0 ] && [ ! -z "$TOTAL_TRANSCRIBED" ]; then
    TRANSCRIPTION_RATE=$(echo "scale=1; $TOTAL_TRANSCRIBED * 100 / $TOTAL" | bc -l 2>/dev/null || echo "N/A")
    echo "Transcription rate:      $TRANSCRIPTION_RATE%"
fi

echo ""
echo "🕒 MOST RECENT DATABASE ENTRIES:"
echo "--------------------------------"

docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "
SELECT 
    date,
    type,
    source_number,
    dest_number,
    filename,
    CASE WHEN transcription IS NOT NULL THEN 'Yes' ELSE 'No' END as transcribed
FROM \"SessionEvent\" 
ORDER BY date DESC 
LIMIT 10;" 2>/dev/null

echo ""
echo "========================================="
