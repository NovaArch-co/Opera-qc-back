#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================${NC}"
echo -e "${CYAN}    TRANSCRIPTION PROGRESS MONITOR${NC}"
echo -e "${CYAN}=========================================${NC}"
echo ""

# Function to get current timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Function to get transcription count for a specific date
get_transcription_count() {
    local date=$1
    docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -t -A -c "
    SELECT COUNT(*) 
    FROM \"SessionEvent\" 
    WHERE DATE(date) = '$date' 
    AND transcription IS NOT NULL;
    " 2>/dev/null || echo "0"
}

# Function to get total calls for a specific date
get_total_calls() {
    local date=$1
    docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -t -A -c "
    SELECT COUNT(*) 
    FROM \"SessionEvent\" 
    WHERE DATE(date) = '$date';
    " 2>/dev/null || echo "0"
}

# Function to get Redis queue status
get_queue_status() {
    local waiting=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:waiting 2>/dev/null || echo "0")
    local active=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:active 2>/dev/null || echo "0")
    local failed=$(docker exec opera-qc-redis redis-cli LLEN bull:transcription-processing:failed 2>/dev/null || echo "0")
    echo "$waiting|$active|$failed"
}

# Function to get recent transcription activity
get_recent_activity() {
    local success_count=$(docker logs app --since="2m" 2>&1 | grep -c "Transcription job.*completed successfully" 2>/dev/null || echo "0")
    local error_count=$(docker logs app --since="2m" 2>&1 | grep -c -i -E "(internal server error|audio processing failed)" 2>/dev/null || echo "0")
    echo "$success_count|$error_count"
}

# Function to calculate transcription rate
calculate_rate() {
    local current=$1
    local previous=$2
    local time_diff=$3
    
    # Check if values are numeric
    if ! [[ "$current" =~ ^[0-9]+$ ]] || ! [[ "$previous" =~ ^[0-9]+$ ]] || ! [[ "$time_diff" =~ ^[0-9]+$ ]]; then
        echo "0"
        return
    fi
    
    if [ "$time_diff" -gt 0 ] && [ "$current" -gt "$previous" ]; then
        local diff=$((current - previous))
        local rate=$(echo "scale=2; $diff * 60 / $time_diff" | bc -l 2>/dev/null || echo "0")
        echo "$rate"
    else
        echo "0"
    fi
}

# Main monitoring function
monitor_progress() {
    echo -e "${BLUE}📊 Current Status: $(get_timestamp)${NC}"
    echo "----------------------------------------"
    
    # Get current counts
    local current_1404_07_09=$(get_transcription_count "1404-07-09")
    local total_1404_07_09=$(get_total_calls "1404-07-09")
    local current_1404_07_08=$(get_transcription_count "1404-07-08")
    local total_1404_07_08=$(get_total_calls "1404-07-08")
    
    # Calculate time difference
    local current_time=$(date +%s)
    local time_diff=$((current_time - previous_time))
    
    # Calculate rates
    local rate_1404_07_09=$(calculate_rate "$current_1404_07_09" "$previous_1404_07_09" "$time_diff")
    local rate_1404_07_08=$(calculate_rate "$current_1404_07_08" "$previous_1404_07_08" "$time_diff")
    
    # Display 1404-07-09 (Today)
    local percentage_1404_07_09=$(echo "scale=1; $current_1404_07_09 * 100 / $total_1404_07_09" | bc -l 2>/dev/null || echo "0")
    echo -e "${GREEN}📅 1404-07-09 (Today):${NC}"
    echo -e "   Transcribed: ${YELLOW}$current_1404_07_09${NC} / ${BLUE}$total_1404_07_09${NC} (${PURPLE}${percentage_1404_07_09}%${NC})"
    if [ "$rate_1404_07_09" != "0" ]; then
        echo -e "   Rate: ${GREEN}${rate_1404_07_09}${NC} transcriptions/hour"
    fi
    echo ""
    
    # Display 1404-07-08 (Recovery)
    local percentage_1404_07_08=$(echo "scale=1; $current_1404_07_08 * 100 / $total_1404_07_08" | bc -l 2>/dev/null || echo "0")
    echo -e "${GREEN}📅 1404-07-08 (Recovery):${NC}"
    echo -e "   Transcribed: ${YELLOW}$current_1404_07_08${NC} / ${BLUE}$total_1404_07_08${NC} (${PURPLE}${percentage_1404_07_08}%${NC})"
    if [ "$rate_1404_07_08" != "0" ]; then
        echo -e "   Rate: ${GREEN}${rate_1404_07_08}${NC} transcriptions/hour"
    fi
    echo ""
    
    # Display queue status
    local queue_status=$(get_queue_status)
    local waiting=$(echo "$queue_status" | cut -d'|' -f1)
    local active=$(echo "$queue_status" | cut -d'|' -f2)
    local failed=$(echo "$queue_status" | cut -d'|' -f3)
    
    echo -e "${BLUE}🔄 Queue Status:${NC}"
    echo -e "   Waiting: ${YELLOW}$waiting${NC}"
    echo -e "   Active: ${GREEN}$active${NC}"
    echo -e "   Failed: ${RED}$failed${NC}"
    echo ""
    
    # Display recent activity
    local activity=$(get_recent_activity)
    local success_count=$(echo "$activity" | cut -d'|' -f1 | tr -d ' ')
    local error_count=$(echo "$activity" | cut -d'|' -f2 | tr -d ' ')
    
    echo -e "${BLUE}⚡ Recent Activity (Last 2 minutes):${NC}"
    echo -e "   Successful: ${GREEN}$success_count${NC}"
    echo -e "   Errors: ${RED}$error_count${NC}"
    echo ""
    
    # Display GPU status if nvidia-smi is available
    if command -v nvidia-smi &> /dev/null; then
        local gpu_usage=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null || echo "N/A")
        local gpu_memory_raw=$(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null || echo "N/A,N/A")
        local gpu_memory_used=$(echo "$gpu_memory_raw" | cut -d',' -f1 | tr -d ' ')
        local gpu_memory_total=$(echo "$gpu_memory_raw" | cut -d',' -f2 | tr -d ' ')
        echo -e "${BLUE}🎮 GPU Status:${NC}"
        echo -e "   Usage: ${YELLOW}${gpu_usage}%${NC}"
        echo -e "   Memory: ${YELLOW}${gpu_memory_used}MiB / ${gpu_memory_total}MiB${NC}"
        echo ""
    fi
    
    # Update previous values for next iteration
    previous_1404_07_09=$current_1404_07_09
    previous_1404_07_08=$current_1404_07_08
    previous_time=$current_time
}

# Initialize variables
previous_1404_07_09=0
previous_1404_07_08=0
previous_time=$(date +%s)

# Check if running in watch mode
if [ "$1" = "--watch" ] || [ "$1" = "-w" ]; then
    echo -e "${CYAN}🔄 Starting continuous monitoring (Press Ctrl+C to stop)${NC}"
    echo ""
    
    while true; do
        clear
        monitor_progress
        echo -e "${CYAN}⏰ Next update in 30 seconds...${NC}"
        sleep 30
    done
else
    # Single run
    monitor_progress
    echo ""
    echo -e "${CYAN}💡 Usage:${NC}"
    echo -e "   ${YELLOW}./monitor_transcription_progress.sh${NC}     - Single check"
    echo -e "   ${YELLOW}./monitor_transcription_progress.sh --watch${NC} - Continuous monitoring"
fi
