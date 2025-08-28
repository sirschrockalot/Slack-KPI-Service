#!/bin/bash

# Script to create Kubernetes secrets for the Aircall Slack Service
# This script reads from environment variables or .env file and creates the necessary secrets

set -e

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

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is not installed or not in PATH"
    exit 1
fi

# Check if we're connected to a cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Not connected to a Kubernetes cluster. Please run 'gcloud container clusters get-credentials' first"
    exit 1
fi

# Namespace
NAMESPACE="aircall-slack"

# Check if namespace exists, create if not
if ! kubectl get namespace $NAMESPACE &> /dev/null; then
    print_status "Creating namespace: $NAMESPACE"
    kubectl create namespace $NAMESPACE
    print_success "Namespace created: $NAMESPACE"
else
    print_status "Namespace already exists: $NAMESPACE"
fi

# Function to get value from environment or .env file
get_value() {
    local var_name=$1
    local env_value=${!var_name}
    
    if [ -n "$env_value" ]; then
        echo "$env_value"
    elif [ -f ".env" ]; then
        # Try to get from .env file
        local env_file_value=$(grep "^${var_name}=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
        if [ -n "$env_file_value" ]; then
            echo "$env_file_value"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

# Function to prompt for value if not found
prompt_for_value() {
    local var_name=$1
    local description=$2
    local value=$(get_value "$var_name")
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}${var_name} not found in environment or .env file${NC}"
        read -p "Please enter $description: " value
        if [ -z "$value" ]; then
            print_error "$var_name is required"
            exit 1
        fi
    fi
    
    echo "$value"
}

print_status "Setting up Kubernetes secrets for Aircall Slack Service..."

# Get values for secrets

AIRCALL_API_ID=$(prompt_for_value "AIRCALL_API_ID" "Aircall API ID")
AIRCALL_API_TOKEN=$(prompt_for_value "AIRCALL_API_TOKEN" "Aircall API token")
SLACK_API_TOKEN=$(prompt_for_value "SLACK_API_TOKEN" "Slack API token")
SLACK_CHANNEL_ID=$(prompt_for_value "SLACK_CHANNEL_ID" "Slack channel ID")
JWT_SECRET=$(prompt_for_value "JWT_SECRET" "JWT secret key")

# Generate JWT secret if not provided
if [ -z "$JWT_SECRET" ]; then
    print_warning "JWT_SECRET not provided, generating a random one..."
    JWT_SECRET=$(openssl rand -base64 32)
    print_success "Generated JWT secret"
fi

# Create secrets file
print_status "Creating secrets.yaml file..."
cat > k8s/secrets.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: aircall-slack-secrets
  namespace: $NAMESPACE
  labels:
    app: aircall-slack-service
type: Opaque
data:

  aircall-api-id: $(echo -n "$AIRCALL_API_ID" | base64)
  aircall-api-token: $(echo -n "$AIRCALL_API_TOKEN" | base64)
  slack-api-token: $(echo -n "$SLACK_API_TOKEN" | base64)
  slack-channel-id: $(echo -n "$SLACK_CHANNEL_ID" | base64)
  jwt-secret: $(echo -n "$JWT_SECRET" | base64)
EOF

print_success "Created k8s/secrets.yaml"

# Apply the secrets
print_status "Applying secrets to Kubernetes cluster..."
kubectl apply -f k8s/secrets.yaml

# Verify secrets were created
print_status "Verifying secrets..."
kubectl get secrets -n $NAMESPACE

print_success "Secrets setup complete!"
print_status "You can now deploy your application using:"
echo "  kubectl apply -f k8s/"
echo ""
print_status "Or use the GitHub Actions workflow:"
echo "  .github/workflows/deploy-to-gks-improved.yml"
