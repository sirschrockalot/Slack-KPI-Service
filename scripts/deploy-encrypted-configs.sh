#!/bin/bash

# Script to deploy encrypted configuration to Heroku
# Usage: ./scripts/deploy-encrypted-configs.sh [app-name]
#   If app-name is not provided, it will use 'slack-kpi-service'

set -e  # Exit on error

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

# Get app name from argument or use default
APP_NAME="${1:-slack-kpi-service}"

print_status "Deploying encrypted configuration to Heroku app: $APP_NAME"

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

# Check if app exists
if ! heroku apps:info --app "$APP_NAME" &> /dev/null; then
    print_error "App '$APP_NAME' not found or you don't have access to it."
    exit 1
fi

print_status "App found: $APP_NAME"

# Load environment variables from .env.local
if [ ! -f ".env.local" ]; then
    print_error ".env.local file not found!"
    print_error "Please create .env.local with your encrypted values first."
    exit 1
fi

print_status "Loading configuration from .env.local..."

# Source the .env.local file to get variables
# Note: This is safe because we're only reading specific variables
export $(grep -v '^#' .env.local | grep -E '^(USE_ENCRYPTION|MASTER_ENCRYPTION_KEY|AIRCALL_API_ID_ENCRYPTED|AIRCALL_API_TOKEN_ENCRYPTED|SLACK_API_TOKEN_ENCRYPTED|SLACK_CHANNEL_ID_ENCRYPTED|SLACK_CHANNEL_ID|JWT_SECRET|DISPO_AGENTS|ACQUISITION_AGENTS|EXCLUDED_USERS)=' | xargs)

# Check required variables
if [ -z "$USE_ENCRYPTION" ] || [ "$USE_ENCRYPTION" != "true" ]; then
    print_error "USE_ENCRYPTION must be set to 'true' in .env.local"
    exit 1
fi

if [ -z "$MASTER_ENCRYPTION_KEY" ]; then
    print_error "MASTER_ENCRYPTION_KEY is not set in .env.local"
    exit 1
fi

if [ -z "$AIRCALL_API_ID_ENCRYPTED" ]; then
    print_error "AIRCALL_API_ID_ENCRYPTED is not set in .env.local"
    exit 1
fi

if [ -z "$AIRCALL_API_TOKEN_ENCRYPTED" ]; then
    print_error "AIRCALL_API_TOKEN_ENCRYPTED is not set in .env.local"
    exit 1
fi

if [ -z "$SLACK_API_TOKEN_ENCRYPTED" ]; then
    print_error "SLACK_API_TOKEN_ENCRYPTED is not set in .env.local"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    print_error "JWT_SECRET is not set in .env.local"
    exit 1
fi

print_success "All required variables found in .env.local"

# Build the config:set command
print_status "Setting Heroku config vars..."

CONFIG_VARS=(
    "USE_ENCRYPTION=true"
    "MASTER_ENCRYPTION_KEY=$MASTER_ENCRYPTION_KEY"
    "AIRCALL_API_ID_ENCRYPTED=$AIRCALL_API_ID_ENCRYPTED"
    "AIRCALL_API_TOKEN_ENCRYPTED=$AIRCALL_API_TOKEN_ENCRYPTED"
    "SLACK_API_TOKEN_ENCRYPTED=$SLACK_API_TOKEN_ENCRYPTED"
    "JWT_SECRET=$JWT_SECRET"
)

# Add optional variables if they exist
if [ -n "$SLACK_CHANNEL_ID_ENCRYPTED" ]; then
    CONFIG_VARS+=("SLACK_CHANNEL_ID_ENCRYPTED=$SLACK_CHANNEL_ID_ENCRYPTED")
elif [ -n "$SLACK_CHANNEL_ID" ]; then
    CONFIG_VARS+=("SLACK_CHANNEL_ID=$SLACK_CHANNEL_ID")
fi

if [ -n "$DISPO_AGENTS" ]; then
    CONFIG_VARS+=("DISPO_AGENTS=$DISPO_AGENTS")
fi

if [ -n "$ACQUISITION_AGENTS" ]; then
    CONFIG_VARS+=("ACQUISITION_AGENTS=$ACQUISITION_AGENTS")
fi

if [ -n "$EXCLUDED_USERS" ]; then
    CONFIG_VARS+=("EXCLUDED_USERS=$EXCLUDED_USERS")
fi

# Set all config vars at once
print_status "Setting ${#CONFIG_VARS[@]} config vars..."
heroku config:set "${CONFIG_VARS[@]}" --app "$APP_NAME"

print_success "Config vars set successfully!"

# Remove old plaintext variables if they exist
print_status "Checking for old plaintext variables to remove..."

OLD_VARS=("AIRCALL_API_ID" "AIRCALL_API_TOKEN" "SLACK_API_TOKEN")

for var in "${OLD_VARS[@]}"; do
    if heroku config:get "$var" --app "$APP_NAME" &> /dev/null; then
        print_warning "Found old plaintext variable: $var"
        read -p "Remove $var? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            heroku config:unset "$var" --app "$APP_NAME"
            print_success "Removed $var"
        fi
    fi
done

# Display summary
print_success "Configuration deployment complete!"
echo ""
echo "📋 Summary:"
echo "  App: $APP_NAME"
echo "  Encryption: Enabled"
echo "  Config vars set: ${#CONFIG_VARS[@]}"
echo ""
echo "🔍 Verify configuration:"
echo "  heroku config --app $APP_NAME"
echo ""
echo "🚀 Next steps:"
echo "  1. Deploy your code: git push heroku main"
echo "  2. Check logs: heroku logs --tail --app $APP_NAME"
echo "  3. Test health: heroku open --app $APP_NAME/health"
echo ""
