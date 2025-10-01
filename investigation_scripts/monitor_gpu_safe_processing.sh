#!/bin/bash

echo "🔍 GPU-Safe Processing Monitor"
echo "============================="
echo "$(date)"
echo ""

echo "📊 Redis Queue Status:"
echo "----------------------"
echo "⏳ Waiting: $(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:waiting 2>/dev/null || echo 'N/A')"
echo "🔄 Active: $(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:active 2>/dev/null || echo 'N/A')"
echo "❌ Failed: $(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:failed 2>/dev/null || echo 'N/A')"
echo ""

echo "🚨 Recent API Errors (last 2 minutes):"
echo "---------------------------------------"
error_count=$(docker logs app --since="2m" 2>&1 | grep -c -i -E "(internal server error|socket hang up|audio processing failed)" || echo "0")
if [ "$error_count" -gt 0 ]; then
    echo "❌ Found $error_count API errors"
    docker logs app --since="2m" 2>&1 | grep -i -E "(internal server error|socket hang up|audio processing failed)" | tail -5
else
    echo "✅ No API errors found"
fi
echo ""

echo "✅ Recent Successful Transcriptions (last 2 minutes):"
echo "----------------------------------------------------"
success_count=$(docker logs app --since="2m" 2>&1 | grep -c "Transcription job.*completed successfully" || echo "0")
echo "🎉 Found $success_count successful transcriptions"
if [ "$success_count" -gt 0 ]; then
    docker logs app --since="2m" 2>&1 | grep "Transcription job.*completed successfully" | tail -3
fi
echo ""

echo "📈 Transcription Progress for 1404-07-09:"
echo "-----------------------------------------"
docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c "
SELECT COUNT(*) as transcribed_calls 
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-09' 
AND transcription IS NOT NULL;
" 2>/dev/null || echo "Database query failed"

echo ""
echo "💡 System should now be stable with 2 GPU workers instead of 30!"
