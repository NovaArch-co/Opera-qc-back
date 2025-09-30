#!/bin/bash

# Optimize Transcription Queue - PRODUCTION SERVER
# Increase worker concurrency and optimize queue processing

echo "========================================="
echo "    TRANSCRIPTION QUEUE OPTIMIZATION"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🚀 OPTIMIZING TRANSCRIPTION QUEUE..."
echo ""

# Check current worker configuration
echo "📊 CURRENT QUEUE STATUS:"
echo "========================"
WAITING=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:waiting 2>/dev/null || echo "ERROR")
ACTIVE=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:active 2>/dev/null || echo "ERROR")
echo "⏳ Waiting: $WAITING jobs"
echo "🔄 Active: $ACTIVE jobs"
echo ""

# Check if we can increase concurrency
echo "⚙️  WORKER CONCURRENCY OPTIMIZATION:"
echo "===================================="
echo "Current active jobs: $ACTIVE"
echo "Recommended: 10-20 concurrent jobs"
echo ""

# Check application container resources
echo "💾 APPLICATION RESOURCES:"
echo "========================"
docker stats --no-stream app | grep app
echo ""

# Check Redis memory usage
echo "🔑 REDIS MEMORY USAGE:"
echo "======================"
docker exec opera-qc-redis redis-cli INFO memory | grep -E "(used_memory_human|used_memory_peak_human)"
echo ""

# Check if we need to restart workers
echo "🔄 WORKER RESTART OPTIONS:"
echo "=========================="
echo "1. Restart application container (will restart workers)"
echo "2. Check worker concurrency settings"
echo "3. Monitor queue processing rate"
echo ""

# Show current processing rate
echo "📈 PROCESSING RATE ANALYSIS:"
echo "============================"
echo "Current backlog: $WAITING jobs"
echo "Active processing: $ACTIVE jobs"
if [ "$ACTIVE" != "ERROR" ] && [ "$ACTIVE" -gt 0 ]; then
    ESTIMATED_HOURS=$((WAITING / ACTIVE))
    echo "Estimated completion time: $ESTIMATED_HOURS hours"
else
    echo "⚠️  No active jobs - check worker status"
fi
echo ""

# Check for stuck jobs
echo "🔍 CHECKING FOR STUCK JOBS:"
echo "============================"
echo "Checking for jobs that might be stuck..."
docker exec opera-qc-redis redis-cli LRANGE bull:transcription-processing:active 0 2
echo ""

# Optimization recommendations
echo "💡 OPTIMIZATION RECOMMENDATIONS:"
echo "================================"
echo "1. 🚀 Increase worker concurrency to 10-20"
echo "2. 🔄 Restart application container"
echo "3. 📊 Monitor API response times"
echo "4. ⚡ Check transcription API server resources"
echo ""

# Show restart commands
echo "🔧 RESTART COMMANDS:"
echo "===================="
echo "# Restart application container:"
echo "docker restart app"
echo ""
echo "# Monitor queue after restart:"
echo "watch -n 5 './quick_queue_check.sh'"
echo ""

# Check if restart is needed
echo "🎯 RESTART RECOMMENDATION:"
echo "=========================="
if [ "$ACTIVE" -lt 5 ]; then
    echo "🔴 LOW CONCURRENCY - Restart recommended"
    echo "Current active jobs: $ACTIVE (should be 10-20)"
elif [ "$WAITING" -gt 1000 ]; then
    echo "🟡 HIGH BACKLOG - Consider restart"
    echo "Backlog: $WAITING jobs"
else
    echo "🟢 QUEUE HEALTHY - No restart needed"
fi

echo ""
echo "📅 Last updated: $(date)"
