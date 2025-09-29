#!/bin/bash

# Script to extract relevant logs for 1404-07-05 application bug investigation
# Run this on your PRODUCTION SERVER (31.184.134.153)

echo "========================================="
echo "  EXTRACTING RELEVANT LOGS"
echo "  Date: 1404-07-05 around 08:00-09:00"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔧 COPY AND RUN THESE COMMANDS ON 31.184.134.153:"
echo "=================================================="
echo ""

echo "# 1. Extract application errors around 08:00-09:00"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(error|fail|exception|timeout|minio|upload|database|transcription)' | head -50"
echo ""

echo "# 2. Extract MinIO errors"
echo "docker logs minio --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(error|fail|exception|timeout|upload|bucket)' | head -20"
echo ""

echo "# 3. Extract database errors"
echo "docker logs postgres --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(error|fail|exception|timeout|connection)' | head -20"
echo ""

echo "# 4. Look for specific file processing errors"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -E '(14040705-083814|14040705-083817|14040705-083927|14040705-083947|14040705-084008)' | head -20"
echo ""

echo "# 5. Look for MinIO upload failures"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(minio|upload|bucket|s3)' | head -20"
echo ""

echo "# 6. Look for database update failures"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(database|prisma|update|session)' | head -20"
echo ""

echo "# 7. Look for transcription queue errors"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(transcription|queue|worker|job)' | head -20"
echo ""

echo "# 8. Get a sample of all logs around the failure time (first 100 lines)"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T08:05:00\" 2>&1 | head -100"
echo ""

echo "========================================="
echo "  ALTERNATIVE: SAVE LOGS TO FILES"
echo "========================================="
echo ""

echo "# Save filtered logs to files for analysis"
echo "mkdir -p /tmp/log_analysis"
echo ""

echo "# Save application errors"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(error|fail|exception|timeout|minio|upload|database|transcription)' > /tmp/log_analysis/app_errors.log"
echo ""

echo "# Save MinIO errors"
echo "docker logs minio --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(error|fail|exception|timeout|upload|bucket)' > /tmp/log_analysis/minio_errors.log"
echo ""

echo "# Save database errors"
echo "docker logs postgres --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -i -E '(error|fail|exception|timeout|connection)' > /tmp/log_analysis/db_errors.log"
echo ""

echo "# Save specific file processing logs"
echo "docker logs app --since=\"2025-09-28T08:00:00\" --until=\"2025-09-28T09:00:00\" 2>&1 | grep -E '(14040705-083814|14040705-083817|14040705-083927|14040705-083947|14040705-084008)' > /tmp/log_analysis/specific_files.log"
echo ""

echo "# Check what we found"
echo "echo '=== APP ERRORS ==='"
echo "wc -l /tmp/log_analysis/app_errors.log"
echo "head -10 /tmp/log_analysis/app_errors.log"
echo ""
echo "echo '=== MINIO ERRORS ==='"
echo "wc -l /tmp/log_analysis/minio_errors.log"
echo "head -10 /tmp/log_analysis/minio_errors.log"
echo ""
echo "echo '=== DB ERRORS ==='"
echo "wc -l /tmp/log_analysis/db_errors.log"
echo "head -10 /tmp/log_analysis/db_errors.log"
echo ""
echo "echo '=== SPECIFIC FILES ==='"
echo "wc -l /tmp/log_analysis/specific_files.log"
echo "head -10 /tmp/log_analysis/specific_files.log"
echo ""

echo "========================================="
echo "  WHAT TO LOOK FOR"
echo "========================================="
echo ""
echo "🔍 KEY ERROR PATTERNS:"
echo "  - 'Error uploading to MinIO'"
echo "  - 'Failed to update session event'"
echo "  - 'MinIO connection failed'"
echo "  - 'Database connection error'"
echo "  - 'Transcription job failed'"
echo "  - 'File not found' (even though files exist)"
echo "  - 'Timeout' errors"
echo "  - 'Permission denied' errors"
echo ""
echo "🎯 EXPECTED FINDINGS:"
echo "  - MinIO upload failures starting around 08:00"
echo "  - Database update errors"
echo "  - Or transcription queue processing errors"
echo ""
echo "Run these commands and share the results!"
