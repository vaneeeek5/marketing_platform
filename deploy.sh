#!/bin/bash
set -e # Stop on error

echo "🚀 Starting deployment..."

# Ensure we are in the project directory
cd "$(dirname "$0")"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please create it first."
    exit 1
fi

# Build and start the containers
echo "🛠️ Building and starting containers..."
docker-compose down --remove-orphans
docker-compose up -d --build

# Wait for container to be ready and run migrations
echo "📂 Running database migrations..."
sleep 5 # Give it a moment to start
docker-compose exec -T marketing-platform npx prisma@6.4.1 migrate deploy

# Clean up unused images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "📍 Access the platform via your domain."
