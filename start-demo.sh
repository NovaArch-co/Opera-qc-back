#!/bin/bash

# Script to start the demo instance of Opera QC Backend

echo "🚀 Starting Opera QC Demo Instance..."
echo ""
echo "Port mappings for demo instance:"
echo "- App:           8081 (backend demo)"
echo "- Frontend:      8082 (frontend)"
echo "- PostgreSQL:    5433 (instead of 5432)"
echo "- Redis:         6380 (instead of 6379)"
echo "- MinIO API:     9002 (instead of 9000)"
echo "- MinIO Console: 9003 (instead of 9001)"
echo "- Debug:         5556 (instead of 5555)"
echo ""

# Check if .env.demo exists
if [ ! -f ".env.demo" ]; then
    echo "⚠️  .env.demo file not found!"
    echo "Creating .env.demo from sample..."
    cp env.demo.sample .env.demo
    echo "✅ Created .env.demo file"
    echo "💡 You can edit .env.demo to customize your demo configuration"
    echo ""
fi

# Stop any existing demo containers
echo "🛑 Stopping any existing demo containers..."
docker compose -f docker-compose.demo.yml down

# Start the demo instance
echo "🔧 Starting demo services..."
docker compose -f docker-compose.demo.yml --env-file .env.demo up -d

echo ""
echo "✅ Demo instance is starting up!"
echo ""
echo "📋 Service URLs:"
echo "- API:                http://localhost:8081"
echo "- Swagger Docs:       http://localhost:8081/docs"
echo "- MinIO Console:      http://localhost:9003"
echo "- PostgreSQL:         localhost:5433"
echo "- Redis:              localhost:6380"
echo ""
echo "🔧 To check logs:"
echo "docker compose -f docker-compose.demo.yml logs -f"
echo ""
echo "🛑 To stop:"
echo "docker compose -f docker-compose.demo.yml down"
echo ""
echo "🧪 Test voice folder processing:"
echo "curl -X POST http://localhost:8081/api/event/processVoiceFolder -u tipax:opera-qc-2024 -H 'Content-Type: application/json'"