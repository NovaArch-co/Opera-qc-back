# Calls API

The Calls API provides a flexible filtering system for retrieving call recordings with various filtering options.

## Base Endpoint

```
GET /api/calls
```

## Authentication

This endpoint requires JWT authentication. Include a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Query Parameters

| Parameter | Type | Format | Description |
|-----------|------|--------|-------------|
| page | number | Integer | Current page number (starting from 1) |
| limit | number | Integer | Number of records per page |
| dateFrom | string | YYYY-MM-DD | Start date for filtering calls |
| dateTo | string | YYYY-MM-DD | End date for filtering calls |
| durationMin | number | Integer | Minimum call duration in seconds |
| durationMax | number | Integer | Maximum call duration in seconds |
| topic | string | Text | Search term for call topic/subject (partial match) |
| emotion | string | Enum | Filter by customer emotion ("خوشحال", "ناراحت", or "عصبانی") |
| destNumber | string | Text | Filter by agent ID/destination number (partial match) |
| routineCheckStart | string | "0" or "1" | Filter by routine start check status (1=completed, 0=not completed) |
| routineCheckEnd | string | "0" or "1" | Filter by routine end check status (1=completed, 0=not completed) |

## Response Structure

```json
{
  "data": [
    {
      "id": "string",
      "destNumber": "string",
      "topic": "string",
      "category": "string",
      "date": "ISO date string",
      "duration": "string",
      "emotion": "string",
      "routinCheckStart": "0" or "1",
      "routinCheckEnd": "0" or "1",
      "explanation": "string",
      "transcription": {
        "wav_customer": [
          {
            "speaker": "string",
            "text": "string"
          }
        ]
      },
      "forbiddenWords": {
        "word1": number,
        "word2": number
      }
    }
  ],
  "pagination": {
    "currentPage": number,
    "totalPages": number,
    "totalItems": number,
    "limit": number,
    "hasNextPage": boolean,
    "hasPrevPage": boolean
  }
}
```

## Example API Calls

### Get all calls with pagination:

```
GET /api/calls?page=1&limit=10
```

### Filter calls by date range:

```
GET /api/calls?page=1&limit=10&dateFrom=2023-01-01&dateTo=2023-01-31
```

### Filter by customer emotion and duration:

```
GET /api/calls?page=1&limit=10&emotion=عصبانی&durationMin=60&durationMax=300
```

### Complex filter example:

```
GET /api/calls?page=1&limit=10&dateFrom=2023-01-01&dateTo=2023-01-31&topic=مشکل&emotion=ناراحت&routineCheckEnd=0
```

## Error Responses

### Invalid Parameters (400 Bad Request)

```json
{
  "error": "Invalid parameters",
  "details": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["durationMin"],
      "message": "Expected number, received string"
    }
  ]
}
```

### Server Error (500 Internal Server Error)

```json
{
  "error": "An unexpected error occurred",
  "message": "Error details"
}
``` 