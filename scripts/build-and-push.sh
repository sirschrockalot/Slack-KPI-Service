#!/bin/bash

# Build and push Docker image to Google Container Registry
# Usage: ./scripts/build-and-push.sh [PROJECT_ID] [IMAGE_TAG]

set -e

# Get project ID from argument or environment
PROJECT_ID=${1:-$GOOGLE_CLOUD_PROJECT}
IMAGE_TAG=${2:-latest}

if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID not provided. Usage: $0 [PROJECT_ID] [IMAGE_TAG]"
    echo "Or set GOOGLE_CLOUD_PROJECT environment variable"
    exit 1
fi

IMAGE_NAME="aircall-slack-service"
FULL_IMAGE_NAME="gcr.io/${PROJECT_ID}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building Docker image: ${FULL_IMAGE_NAME}"

# Build the Docker image
docker build -t ${FULL_IMAGE_NAME} .

echo "Pushing image to Google Container Registry..."

# Configure Docker to use gcloud as a credential helper
gcloud auth configure-docker

# Push the image
docker push ${FULL_IMAGE_NAME}

echo "Image pushed successfully: ${FULL_IMAGE_NAME}"
echo ""
echo "To deploy to Kubernetes, update the image in k8s/deployment.yaml:"
echo "  image: ${FULL_IMAGE_NAME}"