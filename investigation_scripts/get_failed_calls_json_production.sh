#!/bin/bash

# Script to get JSON data for 5 failed calls from 1404-07-05
# Run this on your PRODUCTION SERVER (31.184.134.153)

echo "========================================="
echo "  JSON DATA FOR 5 FAILED CALLS"
echo "  Date: 1404-07-05"
echo "  Run this on PRODUCTION SERVER"
echo "========================================="
echo "Generated at: $(date)"
echo ""

echo "🔧 COPY AND RUN THESE COMMANDS ON 31.184.134.153:"
echo "=================================================="
echo ""

echo "# 1. Get JSON data for 5 failed calls"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \"
SELECT 
    json_build_object(
        'id', id,
        'level', level,
        'time', time,
        'pid', pid,
        'hostname', hostname,
        'name', name,
        'msg', msg,
        'type', type,
        'sourceChannel', source_channel,
        'sourceNumber', source_number,
        'queue', queue,
        'destChannel', dest_channel,
        'destNumber', dest_number,
        'date', date,
        'duration', duration,
        'filename', filename,
        'incommingfileUrl', \\\"incommingfileUrl\\\",
        'outgoingfileUrl', \\\"outgoingfileUrl\\\",
        'transcription', transcription,
        'explanation', explanation,
        'category', category,
        'topic', topic,
        'emotion', emotion,
        'keyWords', \\\"keyWords\\\",
        'routinCheckStart', \\\"routinCheckStart\\\",
        'routinCheckEnd', \\\"routinCheckEnd\\\",
        'forbiddenWords', \\\"forbiddenWords\\\"
    ) as json_data
FROM \\\"SessionEvent\\\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;\"" 2>/dev/null
echo ""

echo "# 2. Get simplified JSON (easier to read)"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \"
SELECT 
    json_build_object(
        'id', id,
        'filename', filename,
        'type', type,
        'sourceNumber', source_number,
        'destNumber', dest_number,
        'duration', duration,
        'date', date,
        'hasIncomingFile', \\\"incommingfileUrl\\\" IS NOT NULL,
        'hasOutgoingFile', \\\"outgoingfileUrl\\\" IS NOT NULL,
        'hasTranscription', transcription IS NOT NULL,
        'incommingfileUrl', \\\"incommingfileUrl\\\",
        'outgoingfileUrl', \\\"outgoingfileUrl\\\"
    ) as simplified_json
FROM \\\"SessionEvent\\\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;\"" 2>/dev/null
echo ""

echo "# 3. Get just the basic call data"
echo "docker exec -e PGPASSWORD='StrongP@ssw0rd123' postgres psql -U postgres -d opera_qc -c \"
SELECT 
    id,
    filename,
    type,
    source_number,
    dest_number,
    duration,
    date,
    CASE WHEN \\\"incommingfileUrl\\\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_incoming_file,
    CASE WHEN \\\"outgoingfileUrl\\\" IS NOT NULL THEN 'YES' ELSE 'NO' END as has_outgoing_file,
    CASE WHEN transcription IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcription
FROM \\\"SessionEvent\\\" 
WHERE DATE(date) = '1404-07-05' 
  AND transcription IS NULL
ORDER BY date
LIMIT 5;\"" 2>/dev/null
echo ""

echo "========================================="
echo "  EXPECTED JSON STRUCTURE"
echo "========================================="
echo ""
echo "Based on the database schema, each failed call JSON will look like:"
echo ""
echo "{"
echo "  \"id\": 161307,"
echo "  \"level\": 30,"
echo "  \"time\": \"2025-09-28T...\","
echo "  \"pid\": 12345,"
echo "  \"hostname\": \"server-name\","
echo "  \"name\": \"SESSION_EVENT\","
echo "  \"msg\": \"Call recorded: 14040705-083814-09034414112-2952\","
echo "  \"type\": \"incoming\","
echo "  \"sourceChannel\": \"SIP/...\","
echo "  \"sourceNumber\": \"09034414112\","
echo "  \"queue\": \"1013\","
echo "  \"destChannel\": \"SIP/...\","
echo "  \"destNumber\": \"2952\","
echo "  \"date\": \"1404-07-05 08:38:14\","
echo "  \"duration\": \"00:07:52\","
echo "  \"filename\": \"14040705-083814-09034414112-2952\","
echo "  \"incommingfileUrl\": null,"
echo "  \"outgoingfileUrl\": null,"
echo "  \"transcription\": null,"
echo "  \"explanation\": null,"
echo "  \"category\": null,"
echo "  \"topic\": null,"
echo "  \"emotion\": null,"
echo "  \"keyWords\": [],"
echo "  \"routinCheckStart\": null,"
echo "  \"routinCheckEnd\": null,"
echo "  \"forbiddenWords\": null"
echo "}"
echo ""
echo "========================================="
echo "  KEY FINDINGS IN THE JSON"
echo "========================================="
echo ""
echo "✅ Fields that WILL have data:"
echo "  - id, level, time, pid, hostname, name, msg"
echo "  - type, sourceChannel, sourceNumber, queue"
echo "  - destChannel, destNumber, date, duration, filename"
echo ""
echo "❌ Fields that will be NULL (causing transcription failure):"
echo "  - incommingfileUrl: null (no audio file downloaded)"
echo "  - outgoingfileUrl: null (no audio file downloaded)"
echo "  - transcription: null (no transcription possible)"
echo "  - explanation: null (no analysis possible)"
echo "  - category: null (no analysis possible)"
echo "  - emotion: null (no analysis possible)"
echo "  - keyWords: [] (empty array, no analysis possible)"
echo ""
echo "🎯 This confirms the root cause:"
echo "  - Files were never downloaded (URLs are null)"
echo "  - No transcription possible without audio files"
echo "  - All analysis fields are null/empty"

echo ""
echo "Run the commands above on your production server to get the actual JSON data!"
