#!/bin/bash
# Redis Health Check and Recovery Script
# Monitors Redis health and automatically recovers from failures

set -euo pipefail

REDIS_PASSWORD="${REDIS_PASSWORD:-$(cat .redis_password 2>/dev/null || echo '')}"
LOG_FILE="/var/log/redis/health-check.log"

# Detect Docker Compose command
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    echo "Error: Docker Compose not found"
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if Redis master is healthy
check_master_health() {
    if docker exec opera-qc-redis-master redis-cli --no-auth-warning -a "$REDIS_PASSWORD" ping &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check if Sentinels are healthy
check_sentinels_health() {
    local healthy_count=0
    for i in 1 2 3; do
        if docker exec "opera-qc-redis-sentinel-$i" redis-cli -p 26379 ping &>/dev/null; then
            ((healthy_count++))
        fi
    done
    
    if [ "$healthy_count" -ge 2 ]; then
        return 0
    else
        return 1
    fi
}

# Restart Redis services
restart_redis_services() {
    log "Restarting Redis services..."
    $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml restart redis-master redis-sentinel-1 redis-sentinel-2 redis-sentinel-3
    sleep 30
}

# Main health check
main() {
    if ! check_master_health; then
        log "❌ Redis master is unhealthy"
        
        if ! check_sentinels_health; then
            log "❌ Sentinels are also unhealthy, restarting services"
            restart_redis_services
        else
            log "✅ Sentinels are healthy, waiting for automatic failover"
            sleep 60
        fi
    else
        log "✅ Redis master is healthy"
    fi
    
    if ! check_sentinels_health; then
        log "❌ Insufficient healthy sentinels, restarting"
        restart_redis_services
    else
        log "✅ Sentinels are healthy"
    fi
}

main "$@"
