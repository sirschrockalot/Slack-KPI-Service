#!/bin/bash

# Start Aircall Slack Agent with Monitoring Features
echo "🚀 Starting Aircall Slack Agent with Monitoring Features..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Please create one with your configuration."
    echo "   You can copy .env.example and fill in your values."
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the service
echo "🔧 Starting the service..."
echo "📊 API Documentation will be available at: http://localhost:3000/api-docs"
echo "📈 Metrics will be available at: http://localhost:3000/metrics"
echo "🏥 Health check at: http://localhost:3000/health"
echo "📋 Service status at: http://localhost:3000/status"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

npm start 