#!/bin/bash

# Fix 3: Retry Failed Transcriptions from 1404-07-05
# This processes the 8,405 failed transcriptions

echo "========================================="
echo "  FIX 3: RETRY FAILED TRANSCRIPTIONS"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔧 PROBLEM IDENTIFIED:"
echo "  - 8,405 calls failed transcription on 1404-07-05"
echo "  - Files exist and are accessible"
echo "  - URLs not saved to database"
echo "  - Need to retry these transcriptions"
echo ""

echo "📊 RETRY STATISTICS:"
echo "==================="

# Database connection details
POSTGRES_USER="postgres"
POSTGRES_DB="opera_qc"
POSTGRES_PASSWORD="StrongP@ssw0rd123"
export PGPASSWORD="$POSTGRES_PASSWORD"

# Check if postgres container is running
if ! docker ps --format "{{.Names}}" | grep -q "postgres"; then
    echo "❌ PostgreSQL container 'postgres' is not running."
    echo "   Please start it with: docker compose up postgres -d"
    exit 1
fi

echo "Getting failed transcription statistics..."
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
SELECT 
    'Total Failed Calls' as metric,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
UNION ALL
SELECT 
    'Calls with Files Available' as metric,
    COUNT(*) as count
FROM \"SessionEvent\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
  AND filename IS NOT NULL;" 2>/dev/null

echo ""
echo "🔧 RETRY STRATEGY:"
echo "=================="
echo ""

echo "1. IMMEDIATE RETRY (Recommended)"
echo "   - Re-queue all failed transcription jobs"
echo "   - Let the fixed transcription queue process them"
echo "   - Monitor progress and success rate"
echo ""

echo "2. BATCH PROCESSING"
echo "   - Process in batches of 100 calls"
echo "   - Monitor each batch for success"
echo "   - Retry failed batches"
echo ""

echo "3. MANUAL PROCESSING"
echo "   - Process specific high-priority calls first"
echo "   - Then process remaining calls"
echo ""

echo "🚀 RETRY IMPLEMENTATION:"
echo "======================="
echo ""

echo "# Method 1: Re-queue all failed jobs"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \""
echo "SELECT id, filename FROM \\\"SessionEvent\\\" "
echo "WHERE DATE(date) = '1404-07-05' AND transcription IS NULL "
echo "ORDER BY date LIMIT 10;\""
echo ""

echo "# Method 2: Create retry script"
echo "cat > retry_transcriptions.js << 'EOF'"
echo "const { PrismaClient } = require('@prisma/client');"
echo "const { addTranscriptionJob } = require('./src/queue/transcriptionQueue');"
echo ""
echo "const prisma = new PrismaClient();"
echo ""
echo "async function retryFailedTranscriptions() {"
echo "    const failedCalls = await prisma.sessionEvent.findMany({"
echo "        where: {"
echo "            date: {"
echo "                gte: new Date('1404-07-05 00:00:00'),"
echo "                lt: new Date('1404-07-06 00:00:00')"
echo "            },"
echo "            transcription: null"
echo "        },"
echo "        select: { id: true, filename: true }"
echo "    });"
echo ""
echo "    console.log(\`Found \${failedCalls.length} failed calls to retry\`);"
echo ""
echo "    for (const call of failedCalls) {"
echo "        try {"
echo "            // Re-queue transcription job"
echo "            await addTranscriptionJob("
echo "                call.id,"
echo "                \`/tmp/\${call.filename}-in.wav\`,"
echo "                \`/tmp/\${call.filename}-out.wav\`,"
echo "                call.filename"
echo "            );"
echo "            console.log(\`Queued retry for call \${call.id}\`);"
echo "        } catch (error) {"
echo "            console.error(\`Failed to queue call \${call.id}:\`, error);"
echo "        }"
echo "    }"
echo "}"
echo ""
echo "retryFailedTranscriptions();"
echo "EOF"
echo ""

echo "🔧 MANUAL RETRY COMMANDS:"
echo "========================"
echo ""

echo "# Get sample of failed calls to test"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \""
echo "SELECT id, filename, date FROM \\\"SessionEvent\\\" "
echo "WHERE DATE(date) = '1404-07-05' AND transcription IS NULL "
echo "ORDER BY date LIMIT 5;\""
echo ""

echo "# Test transcription API with one of these files"
echo "# Download the files first"
echo "curl --user 'Tipax:Goz@r!SimotelTip@x!1404' 'http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=FILENAME-in' -o test_in.wav"
echo "curl --user 'Tipax:Goz@r!SimotelTip@x!1404' 'http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=FILENAME-out' -o test_out.wav"
echo ""

echo "# Test transcription API"
echo "curl -X POST 'http://31.184.134.153:8003/process/' \\"
echo "  -F 'customer=@test_in.wav' \\"
echo "  -F 'agent=@test_out.wav'"
echo ""

echo "🎯 MONITORING RETRY PROGRESS:"
echo "============================"
echo ""

echo "# Monitor transcription queue"
echo "watch -n 5 'docker exec redis redis-cli LLEN bull:transcription-processing:waiting'"
echo ""

echo "# Monitor completed transcriptions"
echo "watch -n 5 'docker exec -e PGPASSWORD=\"StrongP@ssw0rd123\" postgres psql -U postgres -d opera_qc -c \"SELECT COUNT(*) FROM \\\"SessionEvent\\\" WHERE DATE(date) = \\\"1404-07-05\\\" AND transcription IS NOT NULL;\"'"
echo ""

echo "# Monitor failed transcriptions"
echo "watch -n 5 'docker exec redis redis-cli LLEN bull:transcription-processing:failed'"
echo ""

echo "🚀 EXPECTED RESULTS:"
echo "==================="
echo "✅ 8,405 failed calls retried"
echo "✅ High success rate (>90%)"
echo "✅ URLs saved to database"
echo "✅ Transcription data populated"
echo "✅ Complete data recovery"
echo ""

echo "⚠️  IMPORTANT NOTES:"
echo "==================="
echo "1. Ensure transcription API is working before retrying"
echo "2. Monitor system resources during retry"
echo "3. Process in batches to avoid overwhelming the system"
echo "4. Keep backups before making changes"
echo "5. Test with a small batch first"
echo ""

echo "Fix 3 completed! Use these commands to retry failed transcriptions."
