#!/bin/bash

# GKE Setup Script
# This script helps you set up your GKE cluster and deploy the service

set -e

echo "🚀 GKE Setup for Aircall-Slack Service"
echo "======================================="
echo ""

# Check if required tools are installed
echo "Checking prerequisites..."

if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install Google Cloud SDK first."
    echo "   Visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

if ! command -v terraform &> /dev/null; then
    echo "❌ terraform not found. Please install Terraform first."
    echo "   Visit: https://www.terraform.io/downloads"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Installing with gcloud..."
    gcloud components install kubectl
fi

if ! command -v docker &> /dev/null; then
    echo "❌ docker not found. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ All prerequisites found!"
echo ""

# Get project ID
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
    echo "📝 Enter your Google Cloud Project ID:"
    read -r PROJECT_ID
    export GOOGLE_CLOUD_PROJECT="$PROJECT_ID"
else
    PROJECT_ID="$GOOGLE_CLOUD_PROJECT"
fi

echo "Using project: $PROJECT_ID"

# Set project
gcloud config set project "$PROJECT_ID"

# Check if billing is enabled
echo ""
echo "🔍 Checking if billing is enabled..."
if ! gcloud beta billing projects describe "$PROJECT_ID" &> /dev/null; then
    echo "⚠️  Billing is not enabled for this project."
    echo "   Please enable billing in the Google Cloud Console:"
    echo "   https://console.cloud.google.com/billing/projects"
    echo ""
    echo "Press Enter after enabling billing to continue..."
    read -r
fi

# Authenticate Docker
echo ""
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker

# Create terraform.tfvars if it doesn't exist
if [ ! -f "terraform/terraform.tfvars" ]; then
    echo ""
    echo "📝 Creating terraform.tfvars..."
    cp terraform/terraform.tfvars.example terraform/terraform.tfvars
    
    # Update project_id in terraform.tfvars
    sed -i.bak "s/your-gcp-project-id/$PROJECT_ID/g" terraform/terraform.tfvars
    rm terraform/terraform.tfvars.bak 2>/dev/null || true
    
    echo "✅ Created terraform/terraform.tfvars with your project ID"
    echo "   Review and modify if needed: terraform/terraform.tfvars"
fi

# Initialize and apply Terraform
echo ""
echo "🏗️  Setting up infrastructure with Terraform..."
cd terraform

if [ ! -d ".terraform" ]; then
    terraform init
fi

echo ""
echo "Planning infrastructure changes..."
terraform plan

echo ""
echo "Do you want to create the GKE cluster? (y/N)"
read -r CONFIRM
if [[ $CONFIRM =~ ^[Yy]$ ]]; then
    terraform apply
    echo "✅ Infrastructure created successfully!"
else
    echo "❌ Infrastructure creation cancelled."
    echo "   Run 'terraform apply' manually when ready."
    exit 0
fi

cd ..

# Get cluster credentials
echo ""
echo "🔑 Getting cluster credentials..."
CLUSTER_NAME=$(terraform -chdir=terraform output -raw kubernetes_cluster_name)
REGION=$(terraform -chdir=terraform output -raw region)
gcloud container clusters get-credentials "$CLUSTER_NAME" --region "$REGION"

# Verify cluster connection
echo ""
echo "🔍 Verifying cluster connection..."
kubectl cluster-info

# Build and push image
echo ""
echo "🐳 Building and pushing Docker image..."
./scripts/build-and-push.sh "$PROJECT_ID" latest

# Create secrets template
if [ ! -f "k8s/secrets.yaml" ]; then
    echo ""
    echo "📝 Setting up secrets..."
    echo "You need to create k8s/secrets.yaml with your actual secrets."
    echo "Example secrets have been provided in k8s/secrets.yaml.example"
    echo ""
    echo "Would you like to create a basic secrets.yaml file now? (y/N)"
    read -r CREATE_SECRETS
    if [[ $CREATE_SECRETS =~ ^[Yy]$ ]]; then
        cp k8s/secrets.yaml.example k8s/secrets.yaml
        echo "✅ Created k8s/secrets.yaml"
        echo "   ⚠️  Please edit k8s/secrets.yaml and add your actual base64-encoded secrets"
        echo "   Example: echo -n 'your-secret' | base64"
    else
        echo "   Remember to create k8s/secrets.yaml before deploying!"
    fi
fi

# Deploy application
echo ""
echo "🚀 Deploying application..."
./scripts/deploy.sh "$PROJECT_ID" latest

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Check deployment status: kubectl get pods -n aircall-slack"
echo "2. View logs: kubectl logs -n aircall-slack -l app=aircall-slack-service -f"
echo "3. Get external IP: kubectl get service aircall-slack-loadbalancer -n aircall-slack"
echo "4. Update secrets in k8s/secrets.yaml if needed"
echo ""
echo "For more information, see README-GKE.md"