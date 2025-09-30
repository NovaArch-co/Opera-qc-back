#!/bin/bash

# Redis Queue Monitor - PRODUCTION SERVER
# Monitor transcription queue status and progress

echo "========================================="
echo "    REDIS QUEUE MONITOR - PRODUCTION"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔍 CHECKING REDIS QUEUE STATUS..."
echo ""

# Check if Redis container is running
echo "📊 Redis Container Status:"
docker ps | grep redis
echo ""

# Connect to Redis and check queue status
echo "📈 TRANSCRIPTION QUEUE STATUS:"
echo "=============================="

# Check waiting queue
WAITING_JOBS=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:waiting 2>/dev/null || echo "ERROR")
echo "⏳ Waiting Jobs: $WAITING_JOBS"

# Check active queue  
ACTIVE_JOBS=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:active 2>/dev/null || echo "ERROR")
echo "🔄 Active Jobs: $ACTIVE_JOBS"

# Check completed queue
COMPLETED_JOBS=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:completed 2>/dev/null || echo "ERROR")
echo "✅ Completed Jobs: $COMPLETED_JOBS"

# Check failed queue
FAILED_JOBS=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:failed 2>/dev/null || echo "ERROR")
echo "❌ Failed Jobs: $FAILED_JOBS"

echo ""

# Check total Redis memory usage
echo "💾 REDIS MEMORY USAGE:"
echo "======================"
docker exec opera-qc-redis redis-cli INFO memory | grep -E "(used_memory_human|used_memory_peak_human)"
echo ""

# Check total transcription job keys
echo "🔑 TOTAL TRANSCRIPTION JOB KEYS:"
echo "================================"
TOTAL_KEYS=$(docker exec opera-qc-redis redis-cli EVAL "return #redis.call('keys', 'bull:transcription-processing:*')" 0 2>/dev/null || echo "ERROR")
echo "📊 Total Keys: $TOTAL_KEYS"
echo ""

# Show recent failed jobs (if any)
if [ "$FAILED_JOBS" != "ERROR" ] && [ "$FAILED_JOBS" -gt 0 ]; then
    echo "❌ RECENT FAILED JOBS (Last 5):"
    echo "==============================="
    docker exec opera-qc-redis redis-cli LRANGE bull:transcription-processing:failed 0 4
    echo ""
fi

# Show sample waiting jobs
if [ "$WAITING_JOBS" != "ERROR" ] && [ "$WAITING_JOBS" -gt 0 ]; then
    echo "⏳ SAMPLE WAITING JOBS (Last 3):"
    echo "================================"
    docker exec opera-qc-redis redis-cli LRANGE bull:transcription-processing:waiting 0 2
    echo ""
fi

# Check application logs for transcription activity
echo "📝 RECENT TRANSCRIPTION ACTIVITY:"
echo "=================================="
echo "Last 10 transcription-related log entries:"
docker logs app --since="5m" 2>&1 | grep -i -E "(transcription|queue)" | tail -10
echo ""

# Calculate processing rate
echo "📊 PROCESSING RATE ANALYSIS:"
echo "============================"
echo "⏳ Waiting: $WAITING_JOBS jobs"
echo "🔄 Active: $ACTIVE_JOBS jobs" 
echo "✅ Completed: $COMPLETED_JOBS jobs"
echo "❌ Failed: $FAILED_JOBS jobs"

if [ "$WAITING_JOBS" != "ERROR" ] && [ "$WAITING_JOBS" -gt 0 ]; then
    echo ""
    echo "⚠️  QUEUE BACKLOG DETECTED!"
    echo "📈 $WAITING_JOBS jobs waiting for processing"
    echo "💡 Consider checking transcription API health"
fi

echo ""
echo "🔧 MONITORING COMMANDS:"
echo "======================="
echo "# Watch queue status every 10 seconds:"
echo "watch -n 10 './monitor_redis_queue.sh'"
echo ""
echo "# Check transcription API health:"
echo "curl -I http://31.184.134.153:8003/health"
echo ""
echo "# Monitor application logs:"
echo "docker logs app -f | grep -i transcription"
echo ""
echo "# Clear failed jobs if needed:"
echo "docker exec opera-qc-redis redis-cli DEL bull:transcription-processing:failed"
echo ""

echo "🎯 QUEUE HEALTH STATUS:"
echo "======================="
if [ "$WAITING_JOBS" = "ERROR" ]; then
    echo "❌ Redis connection failed - check container status"
elif [ "$WAITING_JOBS" -gt 1000 ]; then
    echo "🔴 HIGH BACKLOG - $WAITING_JOBS jobs waiting"
elif [ "$WAITING_JOBS" -gt 100 ]; then
    echo "🟡 MODERATE BACKLOG - $WAITING_JOBS jobs waiting"
elif [ "$WAITING_JOBS" -gt 0 ]; then
    echo "🟢 LOW BACKLOG - $WAITING_JOBS jobs waiting"
else
    echo "✅ QUEUE EMPTY - All jobs processed!"
fi

echo ""
echo "📅 Last updated: $(date)"
