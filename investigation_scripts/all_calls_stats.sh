#!/bin/bash

# All API Calls Statistics Script (including failed ones)
echo "========================================="
echo "    ALL API CALLS Statistics"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Get container logs
LOGS=$(docker logs app 2>&1)

echo "📞 API CALLS RECEIVED BY DAY (All attempts):"
echo "-------------------------------------------"

# Extract dates from API call logs and count by day
DAILY_CALLS=$(echo "$LOGS" | grep "\[API_CALL_RECEIVED\]" | grep -o "2025-[0-9-]*T[0-9:]*\.[0-9]*Z" | cut -d'T' -f1 | sort | uniq -c | sort -r)

if [ ! -z "$DAILY_CALLS" ]; then
    echo "$DAILY_CALLS" | while read count date; do
        printf "%-12s: %s calls\n" "$date" "$count"
    done
else
    echo "No API calls found in logs (new logging may not be active long enough)"
fi

echo ""
echo "📞 API CALLS RECEIVED BY TYPE:"
echo "-----------------------------"

# Count accepted incoming calls by day
ACCEPTED_DAILY=$(echo "$LOGS" | grep "\[API_CALL_ACCEPTED\]" | grep -o "2025-[0-9-]*T[0-9:]*\.[0-9]*Z" | cut -d'T' -f1 | sort | uniq -c | sort -r)
if [ ! -z "$ACCEPTED_DAILY" ]; then
    echo "Incoming calls accepted by day:"
    echo "$ACCEPTED_DAILY" | while read count date; do
        printf "  %-12s: %s incoming calls\n" "$date" "$count"
    done
else
    echo "No accepted calls found in logs"
fi

# Count skipped outgoing calls by day
SKIPPED_DAILY=$(echo "$LOGS" | grep "\[API_CALL_SKIPPED\]" | grep -o "2025-[0-9-]*T[0-9:]*\.[0-9]*Z" | cut -d'T' -f1 | sort | uniq -c | sort -r)
if [ ! -z "$SKIPPED_DAILY" ]; then
    echo ""
    echo "Outgoing calls skipped by day:"
    echo "$SKIPPED_DAILY" | while read count date; do
        printf "  %-12s: %s outgoing calls\n" "$date" "$count"
    done
fi

echo ""
echo "📊 PROCESSING SUCCESS vs FAILURE:"
echo "--------------------------------"

TOTAL_RECEIVED=$(echo "$LOGS" | grep "\[API_CALL_RECEIVED\]" | wc -l)
ACCEPTED=$(echo "$LOGS" | grep "\[API_CALL_ACCEPTED\]" | wc -l)
SKIPPED=$(echo "$LOGS" | grep "\[API_CALL_SKIPPED\]" | wc -l)
REJECTED=$(echo "$LOGS" | grep "\[API_CALL_REJECTED\]" | wc -l)
QUEUED=$(echo "$LOGS" | grep "\[API_CALL_QUEUED\]" | wc -l)

echo "Total API calls received:     $TOTAL_RECEIVED"
echo "Incoming calls accepted:      $ACCEPTED"
echo "Outgoing calls skipped:       $SKIPPED"
echo "Calls rejected (bad data):    $REJECTED"
echo "Jobs successfully queued:     $QUEUED"

# Calculate loss rate
if [ $TOTAL_RECEIVED -gt 0 ]; then
    LOSS_RATE=$(echo "scale=2; ($TOTAL_RECEIVED - $QUEUED) * 100 / $TOTAL_RECEIVED" | bc -l 2>/dev/null || echo "N/A")
    echo "Call loss rate:               $LOSS_RATE%"
fi

echo ""
echo "📈 DATABASE vs API COMPARISON:"
echo "-----------------------------"

# Try to get database counts using different methods
echo "Checking database records..."

# First try with the postgres container using password
export PGPASSWORD="StrongP@ssw0rd123"
DB_TOTAL=$(docker exec postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\";" 2>/dev/null | head -1)

# If that fails, try interactive mode
if [ -z "$DB_TOTAL" ]; then
    DB_TOTAL=$(docker exec -i postgres psql -U postgres -d opera_qc -t -A << EOF 2>/dev/null | head -1
SELECT COUNT(*) FROM "SessionEvent";
EOF
)
fi

# If still fails, try with environment variable
if [ -z "$DB_TOTAL" ]; then
    DB_TOTAL=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "SELECT COUNT(*) FROM \"SessionEvent\";" 2>/dev/null | head -1)
fi

# If still no result, skip database check
if [ ! -z "$DB_TOTAL" ] && [[ "$DB_TOTAL" =~ ^[0-9]+$ ]]; then
    echo "Database records created:     $DB_TOTAL"
    echo "API calls that reached us:    $TOTAL_RECEIVED"
    
    if [ $TOTAL_RECEIVED -gt 0 ] && [ $DB_TOTAL -gt 0 ]; then
        SUCCESS_RATE=$(echo "scale=1; $DB_TOTAL * 100 / $TOTAL_RECEIVED" | bc -l 2>/dev/null || echo "N/A")
        echo "Processing success rate:      $SUCCESS_RATE%"
    fi

    echo ""
    echo "📊 DATABASE RECORDS BY DAY:"
    echo "---------------------------"
    
    # Get daily database records for last 15 days
    DB_DAILY=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
    SELECT 
        DATE(date)::text as day,
        COUNT(*)::text as total,
        COUNT(CASE WHEN type = 'incoming' THEN 1 END)::text as incoming,
        COUNT(CASE WHEN type = 'outgoing' THEN 1 END)::text as outgoing,
        COUNT(CASE WHEN transcription IS NOT NULL THEN 1 END)::text as transcribed
    FROM \"SessionEvent\" 
    WHERE date >= NOW() - INTERVAL '15 days'
    GROUP BY DATE(date) 
    ORDER BY DATE(date) DESC;" 2>&1)

    if [ ! -z "$DB_DAILY" ] && [[ ! "$DB_DAILY" =~ ERROR ]]; then
        echo "Date         | Total | Incoming | Outgoing | Transcribed"
        echo "-------------|-------|----------|----------|------------"
        echo "$DB_DAILY" | while IFS='|' read -r day total incoming outgoing transcribed; do
            if [ ! -z "$day" ]; then
                printf "%-12s | %-5s | %-8s | %-8s | %-11s\n" "$day" "$total" "$incoming" "$outgoing" "$transcribed"
            fi
        done
    else
        echo "Could not retrieve daily database statistics"
        echo "Debug info: $DB_DAILY"
        echo ""
        echo "Trying simpler query..."
        # Try a simpler query to see recent data
        SIMPLE_DAILY=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
        SELECT 
            DATE(date),
            COUNT(*)
        FROM \"SessionEvent\" 
        WHERE date >= '2025-09-15'
        GROUP BY DATE(date) 
        ORDER BY DATE(date) DESC 
        LIMIT 10;" 2>&1)
        
        if [ ! -z "$SIMPLE_DAILY" ] && [[ ! "$SIMPLE_DAILY" =~ ERROR ]]; then
            echo "Recent days (simplified):"
            echo "$SIMPLE_DAILY" | while IFS='|' read -r day count; do
                if [ ! -z "$day" ]; then
                    printf "%-12s: %s records\n" "$day" "$count"
                fi
            done
        fi
    fi

    echo ""
    echo "📈 RECENT DATABASE ACTIVITY:"
    echo "---------------------------"
    
    # Get most recent records using correct schema
    RECENT_RECORDS=$(docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -t -A -c "
    SELECT 
        TO_CHAR(date, 'YYYY-MM-DD HH24:MI:SS') as call_time,
        type,
        source_number,
        dest_number,
        CASE WHEN transcription IS NOT NULL THEN 'Yes' ELSE 'No' END as transcribed
    FROM \"SessionEvent\" 
    ORDER BY date DESC 
    LIMIT 5;" 2>/dev/null)

    if [ ! -z "$RECENT_RECORDS" ]; then
        echo "Last 5 database records:"
        echo "Call Time           | Type     | From         | To           | Transcribed"
        echo "--------------------|----------|--------------|--------------|------------"
        echo "$RECENT_RECORDS" | while IFS='|' read -r call_time type source dest transcribed; do
            printf "%-19s | %-8s | %-12s | %-12s | %-11s\n" "$call_time" "$type" "$source" "$dest" "$transcribed"
        done
    fi

else
    echo "Database connection failed - skipping DB comparison"
    echo "API calls that reached us:    $TOTAL_RECEIVED"
    echo ""
    echo "Note: You can check database manually with:"
    echo "docker exec -e PGPASSWORD=\"StrongP@ssw0rd123\" postgres psql -U postgres -d opera_qc -c \"SELECT COUNT(*) FROM \\\"SessionEvent\\\";\""
fi

echo ""
echo "🕒 RECENT API ACTIVITY:"
echo "----------------------"
echo "Last 10 API calls received:"
echo "$LOGS" | grep "\[API_CALL_RECEIVED\]" | tail -10 | while read line; do
    timestamp=$(echo "$line" | grep -o "2025-[0-9-]*T[0-9:]*\.[0-9]*Z")
    echo "  • $timestamp"
done

echo ""
echo "========================================="
