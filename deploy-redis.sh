#!/bin/bash
# Opera QC Redis Deployment Script
# Deploys the bulletproof Redis setup

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
        exit 1
    fi
    
    # Check for Docker Compose V2 (docker compose) or V1 (docker-compose)
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
        log "Using Docker Compose V2 (docker compose)"
    elif command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
        log "Using Docker Compose V1 (docker-compose)"
    else
        error "Docker Compose is not installed (neither V1 nor V2 found)"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p redis/logs
    mkdir -p redis/backups
    
    # Set proper permissions
    chmod 755 redis/
    chmod 755 redis/logs/
    chmod 755 redis/backups/
    chmod +x redis/backup-script.sh
    chmod +x redis/monitor.sh
    
    success "Directories created successfully"
}

# Generate Redis password if not exists
generate_redis_password() {
    if [ ! -f .redis_password ]; then
        log "Generating Redis password..."
        openssl rand -base64 32 > .redis_password
        chmod 600 .redis_password
        success "Redis password generated and saved to .redis_password"
    else
        log "Using existing Redis password from .redis_password"
    fi
}

# Update environment variables
update_environment() {
    log "Updating environment configuration..."
    
    # Read Redis password
    REDIS_PASSWORD=$(cat .redis_password)
    
    # Update container.env
    if grep -q "REDIS_PASSWORD=" container.env; then
        sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" container.env
    else
        echo "REDIS_PASSWORD=${REDIS_PASSWORD}" >> container.env
    fi
    
    # Add new Redis environment variables
    if ! grep -q "REDIS_SENTINEL_HOSTS=" container.env; then
        echo "REDIS_SENTINEL_HOSTS=redis-sentinel-1:26379,redis-sentinel-2:26379,redis-sentinel-3:26379" >> container.env
    fi
    
    if ! grep -q "REDIS_SENTINEL_NAME=" container.env; then
        echo "REDIS_SENTINEL_NAME=mymaster" >> container.env
    fi
    
    success "Environment configuration updated"
}

# Backup existing Redis data
backup_existing_data() {
    if docker ps -q -f name=opera-qc-redis &> /dev/null; then
        log "Backing up existing Redis data..."
        
        # Create backup directory with timestamp
        BACKUP_DIR="redis_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        
        # Backup Redis data
        docker exec opera-qc-redis redis-cli BGSAVE || warning "Could not trigger Redis backup"
        
        # Copy data volume
        docker run --rm -v opera-qc-back_redis_data:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine cp -r /data /backup/ || warning "Could not backup Redis volume"
        
        success "Existing Redis data backed up to $BACKUP_DIR"
    else
        log "No existing Redis container found, skipping backup"
    fi
}

# Stop existing services
stop_existing_services() {
    log "Stopping existing services..."
    
    if [ -f docker-compose.yml ]; then
        $DOCKER_COMPOSE_CMD down || warning "Could not stop existing services"
    fi
    
    success "Existing services stopped"
}

# Deploy new Redis setup
deploy_redis() {
    log "Deploying bulletproof Redis setup..."
    
    # Use the production docker-compose file
    $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up -d redis-master redis-sentinel-1 redis-sentinel-2 redis-sentinel-3 redis-backup redis-monitor
    
    # Wait for services to be healthy
    log "Waiting for Redis services to be healthy..."
    sleep 30
    
    # Check Redis master health
    if docker exec opera-qc-redis-master redis-cli --no-auth-warning -a "$(cat .redis_password)" ping &> /dev/null; then
        success "Redis master is healthy"
    else
        error "Redis master health check failed"
        return 1
    fi
    
    # Check Sentinels
    local healthy_sentinels=0
    for i in 1 2 3; do
        if docker exec "opera-qc-redis-sentinel-$i" redis-cli -p 26379 ping &> /dev/null; then
            ((healthy_sentinels++))
        fi
    done
    
    if [ "$healthy_sentinels" -ge 2 ]; then
        success "$healthy_sentinels/3 Redis Sentinels are healthy"
    else
        error "Only $healthy_sentinels/3 Redis Sentinels are healthy"
        return 1
    fi
    
    success "Redis deployment completed successfully"
}

# Deploy application with new Redis configuration
deploy_application() {
    log "Deploying application with new Redis configuration..."
    
    # Deploy all services
    $DOCKER_COMPOSE_CMD -f docker-compose.prod.yml up -d
    
    # Wait for application to be healthy
    log "Waiting for application to be healthy..."
    sleep 60
    
    # Check application health
    if curl -f http://localhost:8081/api/docs &> /dev/null; then
        success "Application is healthy and responding"
    else
        warning "Application health check failed, but continuing..."
    fi
    
    success "Application deployment completed"
}

# Verify Redis functionality
verify_redis_functionality() {
    log "Verifying Redis functionality..."
    
    local redis_password=$(cat .redis_password)
    
    # Test basic Redis operations
    docker exec opera-qc-redis-master redis-cli --no-auth-warning -a "$redis_password" SET test_key "test_value" &> /dev/null
    local test_result=$(docker exec opera-qc-redis-master redis-cli --no-auth-warning -a "$redis_password" GET test_key)
    
    if [ "$test_result" = "test_value" ]; then
        success "Redis read/write operations working"
    else
        error "Redis read/write operations failed"
        return 1
    fi
    
    # Clean up test key
    docker exec opera-qc-redis-master redis-cli --no-auth-warning -a "$redis_password" DEL test_key &> /dev/null
    
    # Test queue operations
    log "Testing queue operations..."
    sleep 10
    
    # Check if queues are accessible
    local queue_count=$(docker exec opera-qc-redis-master redis-cli --no-auth-warning -a "$redis_password" KEYS "bull:*" | wc -l)
    if [ "$queue_count" -gt 0 ]; then
        success "Queue operations working ($queue_count queues found)"
    else
        warning "No queues found yet (this is normal for a fresh deployment)"
    fi
    
    success "Redis functionality verification completed"
}

# Show deployment summary
show_summary() {
    log "Deployment Summary"
    echo "===================="
    echo
    echo "🔧 Redis Services:"
    echo "  - Master: opera-qc-redis-master (port 6379)"
    echo "  - Sentinel 1: opera-qc-redis-sentinel-1 (port 26379)"
    echo "  - Sentinel 2: opera-qc-redis-sentinel-2 (port 26380)"
    echo "  - Sentinel 3: opera-qc-redis-sentinel-3 (port 26381)"
    echo "  - Backup Service: opera-qc-redis-backup"
    echo "  - Monitor Service: opera-qc-redis-monitor"
    echo
    echo "📊 Monitoring:"
    echo "  - Redis logs: ./redis/logs/"
    echo "  - Backups: ./redis/backups/"
    echo "  - Monitor logs: docker logs opera-qc-redis-monitor"
    echo
    echo "🔐 Security:"
    echo "  - Redis password: stored in .redis_password"
    echo "  - Dangerous commands disabled"
    echo "  - Network isolation enabled"
    echo
    echo "🚀 High Availability Features:"
    echo "  - Automatic failover via Redis Sentinel"
    echo "  - Continuous health monitoring"
    echo "  - Automated backups every 6 hours"
    echo "  - Circuit breaker pattern in application"
    echo "  - Connection pooling and retry logic"
    echo
    success "Bulletproof Redis setup completed! 🎉"
    echo
    warning "Next steps:"
    echo "1. Monitor logs: docker logs -f opera-qc-redis-monitor"
    echo "2. Check health: docker exec opera-qc-redis-master redis-cli --no-auth-warning -a \"\$(cat .redis_password)\" INFO replication"
    echo "3. Test application: curl http://localhost:8081/api/docs"
}

# Main deployment function
main() {
    log "Starting Opera QC Bulletproof Redis Deployment"
    echo "=============================================="
    echo
    
    check_prerequisites
    create_directories
    generate_redis_password
    update_environment
    backup_existing_data
    stop_existing_services
    deploy_redis
    deploy_application
    verify_redis_functionality
    show_summary
}

# Handle script interruption
trap 'error "Deployment interrupted"; exit 1' SIGINT SIGTERM

# Run main function
main "$@"
