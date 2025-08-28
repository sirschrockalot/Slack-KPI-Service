#!/bin/bash

# Aircall Slack Agent - Run Options
echo "🚀 Aircall Slack Agent - Choose your run option:"
echo ""
echo "1. Run locally with npm (development)"
echo "2. Run with Docker (production)"
echo "3. Run with Docker + Monitoring stack"
echo "4. Run monitoring stack only"
echo ""

echo ""

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "📦 Starting locally with npm..."
        echo "📊 API Documentation: http://localhost:3000/api-docs"
        echo "📈 Metrics: http://localhost:3000/metrics"
        echo "🏥 Health: http://localhost:3000/health"
        echo ""
        npm install
        npm start
        ;;
    2)
        echo "🐳 Starting with Docker (production)..."
        echo "📊 API Documentation: http://localhost:3000/api-docs"
        echo "📈 Metrics: http://localhost:3000/metrics"
        echo "🏥 Health: http://localhost:3000/health"
        echo ""
        docker-compose up -d
        echo "✅ Application started! Use 'docker-compose logs -f' to view logs"
        ;;
    3)
        echo "🐳 Starting with Docker + Monitoring stack..."
        echo "📊 API Documentation: http://localhost:3000/api-docs"
        echo "📈 Metrics: http://localhost:3000/metrics"
        echo "🏥 Health: http://localhost:3000/health"
        echo "📊 Prometheus: http://localhost:9090"
        echo "📈 Grafana: http://localhost:3001 (admin/admin)"
        echo "🚨 Alertmanager: http://localhost:9093"
        echo ""
        docker-compose --profile monitoring up -d
        echo "✅ Application + Monitoring started!"
        ;;
    4)
        echo "📊 Starting monitoring stack only..."
        echo "📊 Prometheus: http://localhost:9090"
        echo "📈 Grafana: http://localhost:3001 (admin/admin)"
        echo "🚨 Alertmanager: http://localhost:9093"
        echo ""
        docker-compose --profile monitoring up -d
        echo "✅ Monitoring stack started!"
        ;;
    *)
        echo "❌ Invalid choice. Please run the script again."
        exit 1
        ;;
esac 