# Audio Sessions API Guide

## Overview

The `/api/audio/sessions` endpoint is designed to retrieve call session data from the database with support for streaming large datasets and transcription information.

## API Details

### Endpoint
```
GET http://31.184.134.153:8081/api/audio/sessions
```

⚠️ **Important Note**: This API is designed for bulk data export and is very slow. It's not suitable for searching specific dates or real-time queries.

### Authentication
- **Type**: Basic Authentication
- **Username**: `tipax`
- **Password**: `opera-qc-2024`

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `lastId` | string/number | No | undefined | Optional last ID from which to fetch records (exclusive) |
| `batchSize` | string/number | No | 1000 | Number of records to fetch per batch (min: 100, max: 5000) |

### Response Format

The API returns a streaming JSON response with the following structure:

```json
{
  "data": [
    {
      "id": 1,
      "level": 30,
      "type": "incoming",
      "sourceChannel": "SIP/305",
      "sourceNumber": "305",
      "queue": "null",
      "destChannel": "SIP/cisco",
      "destNumber": "BB09938900865",
      "date": "2025-03-03T07:21:41.000Z",
      "duration": "00:02:11",
      "filename": "14030721-191913-09151532004-204",
      "incommingfileUrl": "/audio-files/14030721-191913-09151532004-204-in.wav",
      "outgoingfileUrl": "/audio-files/14030721-191913-09151532004-204-out.wav",
      "transcription": {
        "Agent": "سلام خوش آمدید...",
        "Customer": "سلام، من یک مشکل دارم..."
      },
      "explanation": "مکالمۀ یک مرکز تماس شامل گفتگوی بین نماینده و مشتری است...",
      "category": "سوالی",
      "topic": {"101": "پشتیبانی فنی"},
      "emotion": "ناراحت",
      "keyWords": ["شماره", "وارد", "مشتری", "برنامه", "دیدن"],
      "routinCheckStart": "0",
      "routinCheckEnd": "0",
      "forbiddenWords": {"آهان": 2, "آره": 1},
      "time": "1740801101",
      "pid": 20,
      "hostname": "backend",
      "name": "SESSION_EVENT",
      "msg": "Call recorded: 14030721-191913-09151532004-204"
    }
  ]
}
```

## Key Features

### 1. Streaming Response
- The API uses HTTP streaming to handle large datasets efficiently
- Data is sent in batches to prevent memory issues
- Suitable for processing thousands of records

### 2. Pagination Support
- Use `lastId` parameter to fetch records after a specific ID
- Combine with `batchSize` to control the amount of data per request
- Enables incremental data processing

### 3. Transcription Data
- **`transcription`**: Full transcription with Agent and Customer speech
- **`explanation`**: AI-generated explanation of the call
- **`category`**: Call categorization (e.g., "سوالی", "شکایت")
- **`emotion`**: Detected emotion (e.g., "ناراحت", "راضی")
- **`keyWords`**: Extracted keywords from the conversation
- **`forbiddenWords`**: Count of forbidden words used

## How to Search for Calls on 01-07-1404

### Date Format Analysis
The Persian date **01-07-1404** could appear in filenames as:
- `14040701` (YYYYMMDD format)
- `14040107` (YYYYDDMM format)

### Search Strategy

#### Option 1: Single Batch Search (Quick Test)
```bash
curl -u "tipax:opera-qc-2024" \
  "http://31.184.134.153/api/audio/sessions?batchSize=100"
```

#### Option 2: Full Database Search (Complete)
```javascript
// Pseudo-code for complete search
let lastId = undefined;
let foundCalls = [];
const targetPatterns = ['14040701', '14040107', '140407', '140401'];

do {
  const url = lastId 
    ? `http://31.184.134.153/api/audio/sessions?lastId=${lastId}&batchSize=1000`
    : `http://31.184.134.153/api/audio/sessions?batchSize=1000`;
    
  const response = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + btoa('tipax:opera-qc-2024')
    }
  });
  
  const data = await response.json();
  
  // Search for target date in this batch
  const matchingCalls = data.data.filter(call => 
    targetPatterns.some(pattern => call.filename.includes(pattern))
  );
  
  foundCalls.push(...matchingCalls);
  
  // Update lastId for next batch
  if (data.data.length > 0) {
    lastId = data.data[data.data.length - 1].id;
  }
  
} while (data.data.length > 0);
```

## Usage Examples

### 1. Basic Request
```bash
curl -u "tipax:opera-qc-2024" \
  "http://31.184.134.153/api/audio/sessions?batchSize=10"
```

### 2. Pagination Request
```bash
curl -u "tipax:opera-qc-2024" \
  "http://31.184.134.153/api/audio/sessions?lastId=1000&batchSize=500"
```

### 3. Using JavaScript/Node.js
```javascript
const axios = require('axios');

async function getSessionEvents(lastId, batchSize = 1000) {
  const response = await axios.get('http://31.184.134.153/api/audio/sessions', {
    auth: {
      username: 'tipax',
      password: 'opera-qc-2024'
    },
    params: {
      lastId,
      batchSize
    },
    timeout: 30000
  });
  
  return response.data;
}
```

## Implementation Details

### Repository Layer
- Uses Prisma ORM for database access
- Implements streaming with async generators
- Orders results by ID (ascending) for consistent pagination

### Controller Layer
- Handles HTTP streaming response
- Validates batch size (100-5000 range)
- Sets appropriate headers for streaming

### Security
- Basic Authentication required
- Credentials: `tipax:opera-qc-2024`
- No rate limiting mentioned in code

## Troubleshooting

### Common Issues

1. **Timeout Errors**
   - Increase timeout value
   - Reduce batch size
   - Check server status

2. **Authentication Errors**
   - Verify credentials: `tipax:opera-qc-2024`
   - Ensure Basic Auth header is properly formatted

3. **Large Response Handling**
   - Use streaming response handling
   - Process data in chunks
   - Implement proper memory management

### Server Status Check
```bash
# Test basic connectivity
curl -I "http://31.184.134.153/"

# Test with authentication
curl -u "tipax:opera-qc-2024" -I \
  "http://31.184.134.153/api/audio/sessions"
```

## Next Steps

To check for calls on 01-07-1404:

1. **Test connectivity** to the server
2. **Start with small batch** to verify API works
3. **Implement pagination** to search through all records
4. **Filter results** by filename patterns
5. **Analyze transcription data** for found calls

The API is well-designed for handling large datasets and includes all the transcription information you need to verify whether calls have been processed and analyzed by the AI service.
