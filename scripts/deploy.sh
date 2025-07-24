#!/bin/bash

# Deploy application to GKE
# Usage: ./scripts/deploy.sh [PROJECT_ID] [IMAGE_TAG]

set -e

PROJECT_ID=${1:-$GOOGLE_CLOUD_PROJECT}
IMAGE_TAG=${2:-latest}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID not provided. Usage: $0 [PROJECT_ID] [IMAGE_TAG]"
    echo "Or set GOOGLE_CLOUD_PROJECT environment variable"
    exit 1
fi

IMAGE_NAME="aircall-slack-service"
FULL_IMAGE_NAME="gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Deploying ${FULL_IMAGE_NAME} to Kubernetes..."

# Create namespace
kubectl apply -f k8s/namespace.yaml

# Apply ConfigMap
kubectl apply -f k8s/configmap.yaml

# Apply secrets (if exists)
if [ -f "k8s/secrets.yaml" ]; then
    kubectl apply -f k8s/secrets.yaml
else
    echo "Warning: k8s/secrets.yaml not found. Please create it from k8s/secrets.yaml.example"
fi

# Update deployment with correct image
sed "s|gcr.io/PROJECT_ID/aircall-slack-service:latest|${FULL_IMAGE_NAME}|g" k8s/deployment.yaml | kubectl apply -f -

# Apply ingress
kubectl apply -f k8s/ingress.yaml

echo "Deployment complete!"
echo ""
echo "Check deployment status:"
echo "  kubectl get pods -n aircall-slack"
echo "  kubectl get services -n aircall-slack"
echo "  kubectl get ingress -n aircall-slack"
echo ""
echo "View logs:"
echo "  kubectl logs -n aircall-slack -l app=aircall-slack-service -f"