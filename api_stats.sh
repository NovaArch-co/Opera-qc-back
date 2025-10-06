#!/bin/bash

# API Call Statistics Script
# This script provides comprehensive statistics about API calls to the sessionReceived endpoint

echo "========================================="
echo "    Opera QC API Call Statistics"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Get container logs
LOGS=$(docker logs app 2>&1)

# API Call Statistics
echo "📊 API CALL SUMMARY:"
echo "-------------------"

TOTAL_RECEIVED=$(echo "$LOGS" | grep "\[API_CALL_RECEIVED\]" | wc -l)
ACCEPTED=$(echo "$LOGS" | grep "\[API_CALL_ACCEPTED\]" | wc -l)
SKIPPED=$(echo "$LOGS" | grep "\[API_CALL_SKIPPED\]" | wc -l)
QUEUED=$(echo "$LOGS" | grep "\[API_CALL_QUEUED\]" | wc -l)
REJECTED=$(echo "$LOGS" | grep "\[API_CALL_REJECTED\]" | wc -l)
ERRORS=$(echo "$LOGS" | grep "\[API_CALL_ERROR\]" | wc -l)

echo "Total API calls received:     $TOTAL_RECEIVED"
echo "Incoming calls accepted:      $ACCEPTED"
echo "Outgoing calls skipped:       $SKIPPED"
echo "Jobs successfully queued:     $QUEUED"
echo "Calls rejected (bad data):    $REJECTED"
echo "API processing errors:        $ERRORS"

echo ""
echo "📈 PROCESSING STATISTICS:"
echo "------------------------"

# Calculate percentages if we have data
if [ $TOTAL_RECEIVED -gt 0 ]; then
    INCOMING_PERCENT=$(echo "scale=1; $ACCEPTED * 100 / $TOTAL_RECEIVED" | bc -l 2>/dev/null || echo "N/A")
    OUTGOING_PERCENT=$(echo "scale=1; $SKIPPED * 100 / $TOTAL_RECEIVED" | bc -l 2>/dev/null || echo "N/A")
    SUCCESS_RATE=$(echo "scale=1; $QUEUED * 100 / $ACCEPTED" | bc -l 2>/dev/null || echo "N/A")
    
    echo "Incoming calls percentage:    $INCOMING_PERCENT%"
    echo "Outgoing calls percentage:    $OUTGOING_PERCENT%"
    echo "Success rate (queued/accepted): $SUCCESS_RATE%"
else
    echo "No API calls found with new logging format"
fi

echo ""
echo "🔍 PROCESSING ISSUES:"
echo "--------------------"

# File processing issues
FILE_NOT_FOUND=$(echo "$LOGS" | grep "One or both files not found" | wc -l)
TRANSCRIPTION_ERRORS=$(echo "$LOGS" | grep "Error sending files to transcription API" | wc -l)
SESSION_CREATED=$(echo "$LOGS" | grep "Created session event" | wc -l)
FILES_UPLOADED=$(echo "$LOGS" | grep "Uploaded.*file to MinIO" | wc -l)

echo "Files not found errors:       $FILE_NOT_FOUND"
echo "Transcription API errors:     $TRANSCRIPTION_ERRORS"
echo "Session events created:       $SESSION_CREATED"
echo "Files uploaded to MinIO:      $FILES_UPLOADED"

# Transcription queue statistics
TRANSCRIPTION_JOBS_QUEUED=$(echo "$LOGS" | grep "Queuing transcription job" | wc -l)
TRANSCRIPTION_JOBS_COMPLETED=$(echo "$LOGS" | grep "Transcription job.*completed successfully" | wc -l)
TRANSCRIPTION_JOBS_FAILED=$(echo "$LOGS" | grep "Transcription job.*failed" | wc -l)

echo ""
echo "📝 TRANSCRIPTION PROCESSING:"
echo "---------------------------"
echo "Transcription jobs queued:    $TRANSCRIPTION_JOBS_QUEUED"
echo "Transcription jobs completed: $TRANSCRIPTION_JOBS_COMPLETED"
echo "Transcription jobs failed:    $TRANSCRIPTION_JOBS_FAILED"

echo ""
echo "📅 RECENT ACTIVITY:"
echo "------------------"

# Show last 5 API calls received
echo "Last 5 API calls received:"
echo "$LOGS" | grep "\[API_CALL_RECEIVED\]" | tail -5 | while read line; do
    echo "  • $line"
done

echo ""
echo "🚨 RECENT ERRORS:"
echo "----------------"

# Show recent errors
RECENT_ERRORS=$(echo "$LOGS" | grep -E "\[API_CALL_ERROR\]|One or both files not found|Error sending files to transcription API|Transcription job.*failed" | tail -5)
if [ -n "$RECENT_ERRORS" ]; then
    echo "$RECENT_ERRORS" | while read line; do
        echo "  ⚠️  $line"
    done
else
    echo "  ✅ No recent errors found"
fi

echo ""
echo "========================================="
echo "Script completed successfully"
echo "========================================="
