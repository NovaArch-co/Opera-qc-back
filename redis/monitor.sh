#!/bin/bash
# Redis Health Monitor and Alert System for Opera QC
# Continuously monitors Redis health and sends alerts

set -euo pipefail

# Configuration
REDIS_MASTER_HOST="redis-master"
REDIS_MASTER_PORT="6379"
REDIS_PASSWORD="${REDIS_PASSWORD:-OperaQC2024!Secure}"
SENTINEL_HOSTS=("redis-sentinel-1:26379" "redis-sentinel-2:26379" "redis-sentinel-3:26379")
CHECK_INTERVAL=30
LOG_FILE="/var/log/redis/monitor.log"
WEBHOOK_URL="${WEBHOOK_URL:-}"

# Alert thresholds
MEMORY_THRESHOLD=80
LATENCY_THRESHOLD=100
CONNECTION_THRESHOLD=1000

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Send alert function
send_alert() {
    local severity="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    log "ALERT [$severity]: $message"
    
    # Send webhook alert if configured
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{
                \"text\": \"🚨 Redis Alert [$severity]\",
                \"attachments\": [{
                    \"color\": \"danger\",
                    \"fields\": [{
                        \"title\": \"Message\",
                        \"value\": \"$message\",
                        \"short\": false
                    }, {
                        \"title\": \"Timestamp\",
                        \"value\": \"$timestamp\",
                        \"short\": true
                    }, {
                        \"title\": \"Service\",
                        \"value\": \"Opera QC Redis\",
                        \"short\": true
                    }]
                }]
            }" \
            --max-time 10 --silent || log "Failed to send webhook alert"
    fi
}

# Check Redis master health
check_redis_master() {
    local status="OK"
    local issues=()
    
    # Basic connectivity
    if ! redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning ping > /dev/null 2>&1; then
        issues+=("Master unreachable")
        status="CRITICAL"
    else
        # Check role
        local role=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO replication | grep "role:master" || echo "")
        if [ -z "$role" ]; then
            issues+=("Not in master role")
            status="CRITICAL"
        fi
        
        # Check memory usage
        local memory_info=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO memory)
        local used_memory=$(echo "$memory_info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r')
        local max_memory=$(echo "$memory_info" | grep "maxmemory:" | cut -d: -f2 | tr -d '\r')
        
        if [ "$max_memory" -gt 0 ]; then
            local memory_percent=$((used_memory * 100 / max_memory))
            if [ "$memory_percent" -gt "$MEMORY_THRESHOLD" ]; then
                issues+=("High memory usage: ${memory_percent}%")
                status="WARNING"
            fi
        fi
        
        # Check connected clients
        local clients=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO clients | grep "connected_clients:" | cut -d: -f2 | tr -d '\r')
        if [ "$clients" -gt "$CONNECTION_THRESHOLD" ]; then
            issues+=("High client connections: $clients")
            status="WARNING"
        fi
        
        # Check latency
        local latency=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning --latency-history -i 1 | head -1 | awk '{print $4}' || echo "0")
        if [ "${latency%.*}" -gt "$LATENCY_THRESHOLD" ]; then
            issues+=("High latency: ${latency}ms")
            status="WARNING"
        fi
        
        # Check persistence
        local rdb_status=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO persistence | grep "rdb_last_bgsave_status:ok" || echo "")
        if [ -z "$rdb_status" ]; then
            issues+=("RDB backup failed")
            status="WARNING"
        fi
        
        local aof_status=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO persistence | grep "aof_last_write_status:ok" || echo "")
        if [ -z "$aof_status" ]; then
            issues+=("AOF write failed")
            status="WARNING"
        fi
    fi
    
    if [ "$status" != "OK" ]; then
        local message="Redis Master Issues: $(IFS=', '; echo "${issues[*]}")"
        send_alert "$status" "$message"
    else
        log "Redis Master: Healthy"
    fi
    
    echo "$status"
}

# Check Redis Sentinel health
check_redis_sentinels() {
    local healthy_sentinels=0
    local total_sentinels=${#SENTINEL_HOSTS[@]}
    
    for sentinel in "${SENTINEL_HOSTS[@]}"; do
        local host=$(echo "$sentinel" | cut -d: -f1)
        local port=$(echo "$sentinel" | cut -d: -f2)
        
        if redis-cli -h "$host" -p "$port" ping > /dev/null 2>&1; then
            # Check if sentinel knows about master
            local master_info=$(redis-cli -h "$host" -p "$port" SENTINEL masters | head -20)
            if echo "$master_info" | grep -q "mymaster"; then
                ((healthy_sentinels++))
                log "Sentinel $sentinel: Healthy"
            else
                log "Sentinel $sentinel: No master info"
                send_alert "WARNING" "Sentinel $sentinel has no master information"
            fi
        else
            log "Sentinel $sentinel: Unreachable"
            send_alert "WARNING" "Sentinel $sentinel is unreachable"
        fi
    done
    
    if [ "$healthy_sentinels" -lt 2 ]; then
        send_alert "CRITICAL" "Only $healthy_sentinels/$total_sentinels sentinels are healthy (need at least 2)"
    else
        log "Sentinels: $healthy_sentinels/$total_sentinels healthy"
    fi
}

# Check queue health
check_queue_health() {
    local queue_issues=()
    
    # Check queue lengths
    local queues=("bull:sequential-processing:waiting" "bull:transcription-processing:waiting" "bull:llm-processing:waiting")
    
    for queue in "${queues[@]}"; do
        local length=$(redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning LLEN "$queue" 2>/dev/null || echo "0")
        
        # Alert if queue is too long
        if [ "$length" -gt 1000 ]; then
            queue_issues+=("$queue has $length jobs")
        fi
    done
    
    if [ ${#queue_issues[@]} -gt 0 ]; then
        local message="Queue Issues: $(IFS=', '; echo "${queue_issues[*]}")"
        send_alert "WARNING" "$message"
    else
        log "Queues: Healthy"
    fi
}

# Generate health report
generate_health_report() {
    log "=== Redis Health Report ==="
    
    # Redis info
    redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO server | grep -E "(redis_version|uptime_in_seconds)" | tee -a "$LOG_FILE"
    redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO memory | grep -E "(used_memory_human|maxmemory_human)" | tee -a "$LOG_FILE"
    redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO clients | grep "connected_clients" | tee -a "$LOG_FILE"
    redis-cli -h "$REDIS_MASTER_HOST" -p "$REDIS_MASTER_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO stats | grep -E "(total_commands_processed|instantaneous_ops_per_sec)" | tee -a "$LOG_FILE"
    
    log "=== End Health Report ==="
}

# Main monitoring loop
main() {
    log "Starting Redis health monitoring..."
    
    while true; do
        check_redis_master
        check_redis_sentinels
        check_queue_health
        
        # Generate detailed report every hour
        if [ $(($(date +%M) % 60)) -eq 0 ]; then
            generate_health_report
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Handle signals gracefully
trap 'log "Monitoring stopped"; exit 0' SIGTERM SIGINT

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Start monitoring
main
