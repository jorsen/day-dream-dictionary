#!/usr/bin/env bash
# Build script for Render deployment

echo "🚀 Starting Render build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create uploads directory if needed
mkdir -p uploads

echo "✅ Build completed successfully!"