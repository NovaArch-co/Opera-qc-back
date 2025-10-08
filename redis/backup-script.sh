#!/bin/bash
# Redis Backup Script for Opera QC
# Runs automated backups with rotation and compression

set -euo pipefail

# Configuration
REDIS_HOST="redis-master"
REDIS_PORT="6379"
REDIS_PASSWORD="${REDIS_PASSWORD:-OperaQC2024!Secure}"
BACKUP_DIR="/backups"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/redis/backup.log
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to create RDB backup
create_rdb_backup() {
    log "Starting RDB backup..."
    
    # Trigger BGSAVE
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning BGSAVE
    
    # Wait for backup to complete
    while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)" = "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)" ]; do
        sleep 1
    done
    
    # Copy and compress the dump file
    cp /data/dump.rdb "$BACKUP_DIR/dump_${DATE}.rdb"
    gzip "$BACKUP_DIR/dump_${DATE}.rdb"
    
    log "RDB backup completed: dump_${DATE}.rdb.gz"
}

# Function to create AOF backup
create_aof_backup() {
    log "Starting AOF backup..."
    
    # Rewrite AOF to ensure it's up to date
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning BGREWRITEAOF
    
    # Wait for rewrite to complete
    while [ "$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO persistence | grep aof_rewrite_in_progress:0)" = "" ]; do
        sleep 1
    done
    
    # Copy and compress the AOF file
    if [ -f /data/appendonly.aof ]; then
        cp /data/appendonly.aof "$BACKUP_DIR/appendonly_${DATE}.aof"
        gzip "$BACKUP_DIR/appendonly_${DATE}.aof"
        log "AOF backup completed: appendonly_${DATE}.aof.gz"
    else
        log "WARNING: AOF file not found"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete
    log "Cleanup completed"
}

# Function to verify backup integrity
verify_backup() {
    local backup_file="$1"
    log "Verifying backup integrity: $backup_file"
    
    if gzip -t "$backup_file" 2>/dev/null; then
        log "Backup integrity verified: $backup_file"
        return 0
    else
        log "ERROR: Backup integrity check failed: $backup_file"
        return 1
    fi
}

# Function to get Redis info
get_redis_info() {
    log "Redis instance information:"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO server | grep -E "(redis_version|process_id|uptime_in_seconds)" | tee -a /var/log/redis/backup.log
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO memory | grep -E "(used_memory_human|maxmemory_human)" | tee -a /var/log/redis/backup.log
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning INFO persistence | grep -E "(rdb_last_save_time|aof_enabled)" | tee -a /var/log/redis/backup.log
}

# Main backup function
main() {
    log "=== Starting Redis backup process ==="
    
    # Check if Redis is available
    if ! redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" --no-auth-warning ping > /dev/null 2>&1; then
        log "ERROR: Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT"
        exit 1
    fi
    
    get_redis_info
    
    # Create backups
    create_rdb_backup
    create_aof_backup
    
    # Verify backups
    for backup in "$BACKUP_DIR"/dump_${DATE}.rdb.gz "$BACKUP_DIR"/appendonly_${DATE}.aof.gz; do
        if [ -f "$backup" ]; then
            verify_backup "$backup"
        fi
    done
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Report backup size
    backup_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    log "Total backup directory size: $backup_size"
    
    log "=== Backup process completed successfully ==="
}

# Set up cron job if running as daemon
if [ "${1:-}" = "daemon" ]; then
    log "Setting up backup cron job..."
    echo "0 2 * * * /backup-script.sh" | crontab -
    echo "0 */6 * * * /backup-script.sh" | crontab -  # Every 6 hours
    log "Backup cron job installed (daily at 2 AM and every 6 hours)"
    exec crond -f
else
    # Run backup immediately
    main
fi
