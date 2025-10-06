#!/bin/bash

echo "========================================="
echo "    DATABASE CONNECTION TEST"
echo "========================================="
echo ""

# Test different connection methods
echo "1. Testing basic connection..."
docker exec postgres psql --version 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ PostgreSQL client is available in container"
else
    echo "❌ PostgreSQL client not available"
fi

echo ""
echo "2. Testing container connectivity..."
docker exec postgres echo "Container is accessible" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Container is accessible"
else
    echo "❌ Container is not accessible"
fi

echo ""
echo "3. Testing database connection without password..."
docker exec postgres psql -U postgres -l 2>&1 | head -5

echo ""
echo "4. Testing database connection with password..."
docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -l 2>&1 | head -5

echo ""
echo "5. Testing specific database connection..."
docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "SELECT version();" 2>&1

echo ""
echo "6. Testing table existence..."
docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "\dt" 2>&1

echo ""
echo "7. Testing simple count query..."
docker exec -e PGPASSWORD="StrongP@ssw0rd123" postgres psql -U postgres -d opera_qc -c "SELECT COUNT(*) FROM \"SessionEvent\";" 2>&1

echo ""
echo "========================================="
