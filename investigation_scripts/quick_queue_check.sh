#!/bin/bash

# Quick Redis Queue Check - PRODUCTION SERVER
# Fast queue status check

echo "🔍 Quick Queue Status Check"
echo "=========================="
echo "$(date)"
echo ""

# Quick Redis connection test
echo "📊 Queue Status:"
WAITING=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:waiting 2>/dev/null || echo "ERROR")
ACTIVE=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:active 2>/dev/null || echo "ERROR")
FAILED=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:failed 2>/dev/null || echo "ERROR")

echo "⏳ Waiting: $WAITING"
echo "🔄 Active: $ACTIVE" 
echo "❌ Failed: $FAILED"

# Quick health check
if [ "$WAITING" = "ERROR" ]; then
    echo "❌ Redis connection failed!"
elif [ "$WAITING" -gt 1000 ]; then
    echo "🔴 HIGH BACKLOG!"
elif [ "$WAITING" -gt 100 ]; then
    echo "🟡 Moderate backlog"
elif [ "$WAITING" -gt 0 ]; then
    echo "🟢 Low backlog"
else
    echo "✅ Queue empty!"
fi

echo ""
echo "💡 Run './monitor_redis_queue.sh' for detailed analysis"
