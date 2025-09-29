#!/bin/bash

# Script to find the correct date range for 1404-07-05 logs
# Run this on your PRODUCTION SERVER (31.184.134.153)

echo "========================================="
echo "  FINDING CORRECT DATE RANGE"
echo "  For 1404-07-05 logs"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔧 COPY AND RUN THESE COMMANDS ON 31.184.134.153:"
echo "=================================================="
echo ""

echo "# 1. Check what dates we have in the database"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \"SELECT DISTINCT DATE(date) as persian_date, COUNT(*) as count FROM \\\"SessionEvent\\\" WHERE date >= '1404-07-01' AND date <= '1404-07-10' GROUP BY DATE(date) ORDER BY DATE(date);\""
echo ""

echo "# 2. Find the exact time range for 1404-07-05"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \"SELECT MIN(date) as first_call, MAX(date) as last_call FROM \\\"SessionEvent\\\" WHERE DATE(date) = '1404-07-05';\""
echo ""

echo "# 3. Check recent application logs to see what dates are available"
echo "docker logs app --since=\"2025-09-20\" --until=\"2025-09-30\" 2>&1 | grep -E '(14040705|14040706|14040707)' | head -10"
echo ""

echo "# 4. Look for any 1404-07-05 references in recent logs"
echo "docker logs app --since=\"2025-09-25\" --until=\"2025-09-30\" 2>&1 | grep -E '14040705' | head -10"
echo ""

echo "# 5. Check if there are any logs from the actual failure time"
echo "docker logs app --since=\"2025-09-28T00:00:00\" --until=\"2025-09-28T23:59:59\" 2>&1 | grep -E '(14040705-083814|14040705-083817|14040705-083927)' | head -10"
echo ""

echo "========================================="
echo "  ALTERNATIVE: CHECK LOG ROTATION"
echo "========================================="
echo ""

echo "# Check if logs are rotated and we need to look in different places"
echo "docker logs app --since=\"2025-09-01\" --until=\"2025-09-30\" 2>&1 | grep -E '14040705' | wc -l"
echo ""

echo "# Check all available log dates"
echo "docker logs app --since=\"2025-09-01\" --until=\"2025-09-30\" 2>&1 | grep -E '140407[0-9][0-9]' | head -20"
echo ""

echo "========================================="
echo "  WHAT WE'RE LOOKING FOR"
echo "========================================="
echo ""
echo "🎯 We need to find logs from the actual 1404-07-05 date"
echo "   - This might be a different Gregorian date"
echo "   - Or the logs might be rotated/archived"
echo "   - Or the failure happened on a different day"
echo ""
echo "🔍 Key indicators to look for:"
echo "   - '14040705-083814' (our specific failed file)"
echo "   - '14040705-083817' (another failed file)"
echo "   - '14040705-083927' (another failed file)"
echo "   - Any errors around 08:00-09:00 on that day"
echo ""
echo "Run these commands to find the correct date range!"
