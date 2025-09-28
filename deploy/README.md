# Production Deployment

This directory contains production-ready Docker configurations for the Healthcare Multi-Agent System.

## Files

- `Dockerfile.backend` - Production Dockerfile for the backend service
- `Dockerfile.frontend` - Production Dockerfile for the frontend service
- `Dockerfile.data-generator` - Production Dockerfile for the data generator
- `docker-compose.prod.yml` - Production docker-compose configuration
- `nginx.conf` - Nginx configuration for the frontend service

## Deployment Instructions

1. Make sure you have Docker and Docker Compose installed
2. Set your GEMINI_API_KEY environment variable
3. Run the production services:

```bash
cd deploy
docker-compose -f docker-compose.prod.yml up -d
```

4. Access the application at http://localhost

## Key Improvements

- Uses non-root users for security
- Includes proper health checks
- Optimized for production performance
- Uses nginx for the frontend with proper security headers
- API requests are proxied through nginx to the backend
- Volume mounts for data persistence# Production Deployment

This directory contains production-ready Docker configurations for the Healthcare Multi-Agent System.

## Files

- `Dockerfile.backend` - Production Dockerfile for the backend service
- `Dockerfile.frontend` - Production Dockerfile for the frontend service
- `Dockerfile.data-generator` - Production Dockerfile for the data generator
- `docker-compose.prod.yml` - Production docker-compose configuration
- `nginx.conf` - Nginx configuration for the frontend service

## Deployment Instructions

1. Make sure you have Docker and Docker Compose installed
2. Set your GEMINI_API_KEY environment variable
3. Run the production services:

```bash
cd deploy
docker-compose -f docker-compose.prod.yml up -d
```

4. Access the application at http://localhost

## Key Improvements

- Uses non-root users for security
- Includes proper health checks
- Optimized for production performance
- Uses nginx for the frontend with proper security headers
- API requests are proxied through nginx to the backend
- Volume mounts for data persistence