#!/bin/bash

# Heroku Deployment Script for Slack-KPI-Service
# This script automates the deployment process to Heroku

set -e  # Exit on any error

echo "🚀 Starting Heroku deployment for Slack-KPI-Service..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    print_error "Heroku CLI is not installed. Please install it first."
    echo "Visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    print_warning "Not logged in to Heroku. Please login first."
    heroku login
fi

# Get app name from command line argument or prompt
if [ -n "$1" ]; then
    APP_NAME="$1"
else
    echo -n "Enter your Heroku app name: "
    read APP_NAME
fi

if [ -z "$APP_NAME" ]; then
    print_error "App name is required"
    exit 1
fi

print_status "Deploying to Heroku app: $APP_NAME"

# Check if app exists, if not create it
if ! heroku apps:info --app "$APP_NAME" &> /dev/null; then
    print_status "Creating new Heroku app: $APP_NAME"
    heroku create "$APP_NAME"
else
    print_status "Using existing Heroku app: $APP_NAME"
fi

# Add Heroku remote if not already added
if ! git remote | grep -q heroku; then
    print_status "Adding Heroku remote..."
    heroku git:remote -a "$APP_NAME"
fi



# Check if required environment variables are set
print_status "Checking environment variables..."

REQUIRED_VARS=("AIRCALL_API_ID" "AIRCALL_API_TOKEN" "SLACK_API_TOKEN" "SLACK_CHANNEL_ID" "JWT_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! heroku config:get "$var" --app "$APP_NAME" &> /dev/null || [ -z "$(heroku config:get "$var" --app "$APP_NAME")" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_warning "Missing required environment variables: ${MISSING_VARS[*]}"
    echo "Please set them using: heroku config:set VARIABLE_NAME=value --app $APP_NAME"
    echo ""
    echo "Required variables:"
    echo "  AIRCALL_API_ID - Your Aircall API ID"
    echo "  AIRCALL_API_TOKEN - Your Aircall API Token"
    echo "  SLACK_API_TOKEN - Your Slack Bot Token (starts with xoxb-)"
    echo "  SLACK_CHANNEL_ID - The Slack channel ID where reports will be sent"
    echo "  JWT_SECRET - Secret key for JWT token generation"
    echo ""
    echo "Example:"
    echo "  heroku config:set AIRCALL_API_ID=your_api_id --app $APP_NAME"
    echo ""
    read -p "Press Enter to continue with deployment (you can set variables later) or Ctrl+C to cancel..."
fi

# Set default environment variables if not already set
print_status "Setting default environment variables..."

DEFAULT_VARS=(
    "NODE_ENV=production"
    "PORT=6000"
    "EXCLUDED_USERS=Joel Schrock,Test User"
    "AFTERNOON_REPORT_TIME=19:34"
    "NIGHT_REPORT_TIME=22:00"
    "TZ=America/Chicago"
    "ENABLE_SWAGGER=true"
    "ENABLE_METRICS=true"
    "LOG_LEVEL=info"
)

for var in "${DEFAULT_VARS[@]}"; do
    key="${var%%=*}"
    value="${var#*=}"
    if ! heroku config:get "$key" --app "$APP_NAME" &> /dev/null || [ -z "$(heroku config:get "$key" --app "$APP_NAME")" ]; then
        print_status "Setting $key..."
        heroku config:set "$key=$value" --app "$APP_NAME"
    fi
done

# Commit changes if there are any
if ! git diff-index --quiet HEAD --; then
    print_status "Committing changes..."
    git add .
    git commit -m "Deploy to Heroku - $(date)"
fi

# Deploy to Heroku
print_status "Deploying to Heroku..."
git push heroku main

# Wait for deployment to complete
print_status "Waiting for deployment to complete..."
sleep 10

# Check if the app is running
print_status "Checking app status..."
if heroku ps --app "$APP_NAME" | grep -q "up"; then
    print_success "App is running successfully!"
else
    print_error "App failed to start. Check logs with: heroku logs --tail --app $APP_NAME"
    exit 1
fi

# Test health endpoint
print_status "Testing health endpoint..."
HEALTH_URL="https://$APP_NAME.herokuapp.com/health"
if curl -s "$HEALTH_URL" | grep -q "healthy"; then
    print_success "Health check passed!"
else
    print_warning "Health check failed. The app might still be starting up."
fi

# Display app information
print_success "Deployment completed!"
echo ""
echo "🌐 App URL: https://$APP_NAME.herokuapp.com"
echo "📊 Health Check: https://$APP_NAME.herokuapp.com/health"
echo "📚 API Docs: https://$APP_NAME.herokuapp.com/api-docs"
echo "📈 Metrics: https://$APP_NAME.herokuapp.com/metrics"
echo ""
echo "📋 Useful commands:"
echo "  View logs: heroku logs --tail --app $APP_NAME"
echo "  Open app: heroku open --app $APP_NAME"
echo "  Check status: heroku ps --app $APP_NAME"
echo "  Restart app: heroku restart --app $APP_NAME"
echo ""
echo "🔑 To test API endpoints, generate a JWT token:"
echo "  node -e \"const jwt = require('jsonwebtoken'); console.log(jwt.sign({user: 'test'}, '$(heroku config:get JWT_SECRET --app "$APP_NAME")'));\""
echo ""
echo "📝 Example API call:"
echo "  curl -X POST https://$APP_NAME.herokuapp.com/report/afternoon \\"
echo "    -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\"
echo "    -H \"Content-Type: application/json\""
