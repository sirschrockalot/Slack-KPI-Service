#!/bin/bash

# Local Environment Setup Script for Docker Testing
echo "🚀 Setting up local environment for Docker testing..."

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local file found"
    echo "📝 Loading environment variables from .env.local..."
    
    # Load environment variables more safely
    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
            # Export the variable
            export "$line"
        fi
    done < .env.local
else
    echo "⚠️  .env.local file not found"
    echo "📝 Creating .env.local template..."
    
    cat > .env.local << 'EOF'
# Local Development Environment Variables
# Fill in your actual values below

# Aircall API Configuration
AIRCALL_API_ID=your_aircall_api_id_here
AIRCALL_API_TOKEN=your_aircall_api_token_here

# Slack Configuration
SLACK_API_TOKEN=xoxb-your-slack-bot-token-here
SLACK_CHANNEL_ID=C1234567890

# JWT Secret (for local testing)
JWT_SECRET=your_local_jwt_secret_for_testing

# Excluded Users (comma-separated list)
EXCLUDED_USERS=Test User,Another Test User
EOF

    echo "✅ Created .env.local template"
    echo "📝 Please edit .env.local with your actual values"
    echo "🔑 You'll need to get your Aircall API credentials and Slack tokens"
    exit 1
fi

# Validate required environment variables
echo "🔍 Validating environment variables..."

required_vars=("AIRCALL_API_ID" "AIRCALL_API_TOKEN" "SLACK_API_TOKEN" "SLACK_CHANNEL_ID")

for var in "${required_vars[@]}"; do
    # Get the value of the variable
    value="${!var}"
    
    # Check if variable is empty or contains placeholder
    if [ -z "$value" ] || [[ "$value" == *"your_"*"_here" ]]; then
        echo "❌ Missing or placeholder value for $var"
        echo "📝 Please update .env.local with your actual values"
        exit 1
    fi
done

echo "✅ All required environment variables are set"
echo "🚀 Ready to run Docker Compose!"
echo ""
echo "📋 Next steps:"
echo "1. Run: docker-compose -f docker-compose.local.yml up --build"
echo "2. Access your app at: http://localhost:6000"
echo "3. Health check: http://localhost:6000/health"
echo "4. API docs: http://localhost:6000/api-docs"
echo "5. Metrics: http://localhost:6000/metrics"
echo ""
echo "🛑 To stop: docker-compose -f docker-compose.local.yml down"
