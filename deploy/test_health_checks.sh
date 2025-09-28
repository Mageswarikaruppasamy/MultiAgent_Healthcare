#!/bin/bash
# deploy/test_health_checks.sh
# Script to test health checks in deployment Dockerfiles

echo "Testing Backend Health Check..."
echo "=============================="
echo "Checking if curl is installed in backend Dockerfile..."
if grep -q "curl" Dockerfile.backend; then
    echo "✅ curl is installed in backend Dockerfile"
else
    echo "❌ curl is missing from backend Dockerfile"
fi

echo ""
echo "Testing Frontend Health Check..."
echo "==============================="
echo "Checking if wget is installed in frontend Dockerfile..."
if grep -q "wget" Dockerfile.frontend; then
    echo "✅ wget is installed in frontend Dockerfile"
else
    echo "❌ wget is missing from frontend Dockerfile"
fi

echo ""
echo "Testing Data Generator Health Check..."
echo "===================================="
echo "Checking if curl is installed in data generator Dockerfile..."
if grep -q "curl" Dockerfile.data-generator; then
    echo "✅ curl is installed in data generator Dockerfile"
else
    echo "❌ curl is missing from data generator Dockerfile"
fi

echo ""
echo "Testing Docker Compose Configuration..."
echo "======================================"
echo "Checking docker-compose.prod.yml for proper healthcheck configurations..."

if grep -q "curl.*health" docker-compose.prod.yml; then
    echo "✅ Backend healthcheck configured correctly"
else
    echo "❌ Backend healthcheck not configured correctly"
fi

if grep -q "wget.*spider" docker-compose.prod.yml; then
    echo "✅ Frontend healthcheck configured correctly"
else
    echo "❌ Frontend healthcheck not configured correctly"
fi

echo ""
echo "✅ All health check tests completed!"