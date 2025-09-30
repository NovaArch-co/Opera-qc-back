#!/bin/bash

# Retry Failed Transcription Calls from 1404-07-08
# This script retries all 3,325 calls from 1404-07-08 that have no transcriptions

echo "========================================="
echo "  RETRYING FAILED CALLS FROM 1404-07-08"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔍 Finding calls from 1404-07-08 without transcriptions..."
echo ""

# Get all calls from 1404-07-08 that have no transcription
FAILED_CALLS=$(docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -t -c "
SELECT COUNT(*) FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-08' 
AND transcription IS NULL 
AND \"incommingfileUrl\" IS NOT NULL 
AND \"outgoingfileUrl\" IS NOT NULL;
" | tr -d ' ')

echo "📊 Found $FAILED_CALLS calls to retry"
echo ""

if [ "$FAILED_CALLS" -eq 0 ]; then
    echo "✅ No calls found to retry!"
    exit 0
fi

# Show sample of calls to retry
echo "📋 Sample calls to retry:"
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c "
SELECT id, filename, date 
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-08' 
AND transcription IS NULL 
AND \"incommingfileUrl\" IS NOT NULL 
AND \"outgoingfileUrl\" IS NOT NULL
ORDER BY date 
LIMIT 5;
"
echo ""

echo "🚀 Starting retry process..."
echo ""

# Create a temporary SQL file to queue all the calls
echo "📝 Creating retry job queue..."

# Get all failed call IDs
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -t -c "
SELECT id FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-08' 
AND transcription IS NULL 
AND \"incommingfileUrl\" IS NOT NULL 
AND \"outgoingfileUrl\" IS NOT NULL
ORDER BY date;
" > /tmp/failed_call_ids.txt

echo "📊 Processing $FAILED_CALLS calls in batches..."
echo ""

# Process in batches of 100
BATCH_SIZE=100
PROCESSED=0
BATCH_NUM=1

while IFS= read -r call_id; do
    if [ -n "$call_id" ] && [ "$call_id" != " " ]; then
        # Get filename for this call
        FILENAME=$(docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -t -c "
        SELECT filename FROM \"SessionEvent\" WHERE id = $call_id;
        " | tr -d ' ')
        
        if [ -n "$FILENAME" ]; then
            # Queue transcription job via Redis
            docker exec opera-qc-redis redis-cli LPUSH bull:transcription-processing:waiting "{\"sessionEventId\":$call_id,\"customerFilePath\":\"/tmp/opera-qc/$FILENAME-in.wav\",\"agentFilePath\":\"/tmp/opera-qc/$FILENAME-out.wav\",\"filename\":\"$FILENAME\"}"
            
            PROCESSED=$((PROCESSED + 1))
            
            # Show progress every 100 calls
            if [ $((PROCESSED % 100)) -eq 0 ]; then
                echo "  ✅ Queued $PROCESSED/$FAILED_CALLS calls..."
            fi
            
            # Batch processing - wait every 100 calls
            if [ $((PROCESSED % BATCH_SIZE)) -eq 0 ]; then
                echo "  📦 Completed batch $BATCH_NUM ($BATCH_SIZE calls)"
                echo "  ⏳ Waiting 2 seconds before next batch..."
                sleep 2
                BATCH_NUM=$((BATCH_NUM + 1))
            fi
        fi
    fi
done < /tmp/failed_call_ids.txt

# Clean up temp file
rm -f /tmp/failed_call_ids.txt

echo ""
echo "🎯 RETRY SUMMARY:"
echo "=================="
echo "📊 Total calls found: $FAILED_CALLS"
echo "✅ Successfully queued: $PROCESSED"
echo "📈 Success rate: $(( (PROCESSED * 100) / FAILED_CALLS ))%"
echo ""

echo "🔍 MONITORING COMMANDS:"
echo "========================"
echo "# Check queue status:"
echo "docker exec -it opera-qc-redis redis-cli"
echo "LLEN bull:transcription-processing:waiting"
echo "LLEN bull:transcription-processing:failed"
echo ""
echo "# Monitor transcription progress:"
echo "watch -n 10 \"docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \\\"SELECT COUNT(*) FROM \\\\\\\"SessionEvent\\\\\\\" WHERE DATE(date) = '1404-07-08' AND transcription IS NOT NULL;\\\"\""
echo ""

echo "🚀 Expected Results:"
echo "==================="
echo "✅ $FAILED_CALLS calls queued for transcription"
echo "✅ High success rate (>90%)"
echo "✅ Transcription data populated"
echo "✅ Complete data recovery for 1404-07-08"
echo ""

echo "⚠️  IMPORTANT NOTES:"
echo "==================="
echo "1. Monitor system resources during processing"
echo "2. Transcription API must be running and healthy"
echo "3. Process may take several hours to complete"
echo "4. Check logs for any errors: docker logs app | grep -i error"
echo ""

echo "🎉 Retry process completed! Monitor the progress with the commands above."
