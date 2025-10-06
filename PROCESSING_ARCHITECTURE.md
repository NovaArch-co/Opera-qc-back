# Two-Stage Processing Architecture

## Problem Solved

Previously, the system used sequential processing with concurrency=1, which created a bottleneck:
- Webhook calls → Download files → Create DB record → **SLOW transcription API call** → Update DB record
- While one call was being transcribed (potentially taking minutes), all other webhook calls had to wait
- This caused webhook calls to be lost or timeout, explaining the discrepancy between expected calls (13,000) and processed calls (~1,445)

## New Architecture

### Stage 1: Fast Processing (Sequential Queue)
**Purpose**: Capture all webhook calls quickly without blocking
**Processing**:
1. Receive webhook call
2. Download audio files from file server
3. Upload files to MinIO storage
4. Create SessionEvent record in database
5. Queue transcription job in background
6. Return success response immediately

**Characteristics**:
- Still uses `concurrency: 1` for data consistency
- Fast operations only (no transcription API calls)
- Webhook calls complete in seconds, not minutes

### Stage 2: Slow Processing (Transcription Queue)
**Purpose**: Handle time-consuming transcription and analysis
**Processing**:
1. Pick up transcription jobs from queue
2. Send audio files to transcription API
3. Process transcription and analysis results
4. Update SessionEvent record with results
5. Clean up temporary files

**Characteristics**:
- Uses `concurrency: 3` for parallel processing
- Handles retries and error recovery
- Runs independently of webhook processing

## Benefits

1. **No Lost Webhook Calls**: All calls are captured immediately
2. **Fast Response Times**: Webhook calls complete in seconds
3. **Parallel Transcription**: Multiple transcriptions can run simultaneously
4. **Better Error Handling**: Transcription failures don't affect webhook reception
5. **Scalability**: Can adjust transcription concurrency based on load

## Queue Structure

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Webhook Call  │───▶│  Sequential      │───▶│  Transcription      │
│                 │    │  Queue           │    │  Queue              │
│                 │    │  (concurrency:1) │    │  (concurrency:3)    │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
       Fast                    Fast                     Slow
     (seconds)              (seconds)                (minutes)
```

## Monitoring

The updated `api_stats.sh` script now tracks:
- API call statistics (received, accepted, queued)
- Fast processing metrics (files uploaded, DB records created)
- Transcription processing metrics (queued, completed, failed)
- Error tracking for both stages

## Files Modified

- `src/queue/transcriptionQueue.ts` - New dedicated transcription queue
- `src/queue/sequentialQueue.ts` - Modified for fast processing only  
- `src/server.ts` - Initialize transcription worker
- `api_stats.sh` - Enhanced monitoring for two-stage processing
