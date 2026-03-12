#!/bin/bash

# Marketing Platform Deployment Script
# ==========================================

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
docker-compose up -d --build

# Clean up unused images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "📍 Access the platform at http://localhost:3000 (or your server's IP)"
