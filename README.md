# Opera QC Backend

Backend service for the Opera QC system.

## Setup

1. Copy `.env.example` to `.env` and configure environment variables
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`

## Docker Setup

```bash
docker-compose up -d
```

## API Documentation

Swagger UI is available at `/api/docs` when the server is running. By default, it's available at:

```
http://localhost:8081/api/docs
```

### Using the Swagger UI "Try it out" Feature

When using the "Try it out" feature in Swagger UI, make sure that:

1. Your request URLs start with `/api` and not `/api/docs/api`
2. If you're seeing incorrect URLs in the curl examples, manually adjust them by removing the duplicate `/api/docs` path segment

For example:
- Incorrect: `http://localhost:8081/api/docs/api/audio/sessions`
- Correct: `http://localhost:8081/api/audio/sessions`

## Authentication

Most API endpoints require JWT authentication. Some specific endpoints may use basic authentication instead.

### Basic Auth Endpoints

The following endpoints use basic authentication:

- `/api/audio/*` - Username: `tipax`, Password: `opera-qc-2024`

### JWT Authentication

To get a JWT token, use the `/api/auth/login` endpoint with valid credentials.
