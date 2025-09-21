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

# Get database counts
DB_TOTAL=$(docker exec -it postgres psql -U postgres -d opera_qc -c "SELECT COUNT(*) FROM \"SessionEvent\";" | grep -o '[0-9]*' | head -1)
echo "Database records created:     $DB_TOTAL"
echo "API calls that reached us:    $TOTAL_RECEIVED"

if [ $TOTAL_RECEIVED -gt 0 ] && [ $DB_TOTAL -gt 0 ]; then
    SUCCESS_RATE=$(echo "scale=1; $DB_TOTAL * 100 / $TOTAL_RECEIVED" | bc -l 2>/dev/null || echo "N/A")
    echo "Processing success rate:      $SUCCESS_RATE%"
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
