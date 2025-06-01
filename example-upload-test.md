# Sequential Audio Upload API

This branch introduces a new route that allows direct upload of customer and agent audio files, bypassing the file download step.

## New Route

`POST /api/sequential/jobs/upload`

## Usage

### Using cURL

```bash
curl -X POST \
  http://localhost:8080/api/sequential/jobs/upload \
  -H 'Content-Type: multipart/form-data' \
  -F 'customer=@/path/to/customer-audio.wav' \
  -F 'agent=@/path/to/agent-audio.wav' \
  -F 'type=uploaded' \
  -F 'sourceNumber=123456789' \
  -F 'destNumber=987654321' \
  -F 'duration=120' \
  -F 'date=2024-01-01T10:00:00Z'
```

### Using JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append('customer', customerAudioFile); // File object
formData.append('agent', agentAudioFile); // File object
formData.append('type', 'uploaded');
formData.append('sourceNumber', '123456789');
formData.append('destNumber', '987654321');
formData.append('duration', '120');
formData.append('date', new Date().toISOString());

const response = await fetch('/api/sequential/jobs/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

### Using Python Requests

```python
import requests

files = {
    'customer': open('customer-audio.wav', 'rb'),
    'agent': open('agent-audio.wav', 'rb')
}

data = {
    'type': 'uploaded',
    'sourceNumber': '123456789',
    'destNumber': '987654321',
    'duration': 120,
    'date': '2024-01-01T10:00:00Z'
}

response = requests.post(
    'http://localhost:8080/api/sequential/jobs/upload',
    files=files,
    data=data
)

print(response.json())
```

## Response

```json
{
  "success": true,
  "message": "Files uploaded and sequential processing started",
  "data": {
    "jobId": "job-uuid",
    "status": "waiting",
    "customerFile": "customer-audio.wav",
    "agentFile": "agent-audio.wav"
  },
  "statusCode": 200
}
```

## Key Differences

1. **Direct Upload**: Files are uploaded directly instead of being downloaded from a file server
2. **Bypasses Download Step**: The processing starts immediately with the uploaded files
3. **Same Analysis Pipeline**: Uses the same transcription and analysis APIs as the original route
4. **Sequential Processing**: Maintains the same sequential processing queue to ensure one-at-a-time processing

## File Requirements

- **Supported formats**: WAV, MP3, MPEG, OGG
- **Maximum file size**: 100MB per file
- **Required files**: Both `customer` and `agent` audio files must be provided

## Optional Parameters

- `type`: Call type (default: "uploaded")
- `sourceChannel`: Source channel
- `sourceNumber`: Source phone number
- `queue`: Queue name
- `destChannel`: Destination channel
- `destNumber`: Destination phone number
- `duration`: Call duration in seconds
- `date`: Call date and time (ISO format) 