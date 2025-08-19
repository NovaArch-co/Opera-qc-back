#!/bin/bash

# Script to stop the demo instance of Opera QC Backend

echo "🛑 Stopping Opera QC Demo Instance..."

# Stop all demo containers
docker compose -f docker-compose.demo.yml down

echo ""
echo "✅ Demo instance stopped!"
echo ""
echo "💡 To remove demo data volumes (WARNING: This will delete all demo data):"
echo "docker compose -f docker-compose.demo.yml down -v"
echo ""
echo "🚀 To restart:"
echo "./start-demo.sh"