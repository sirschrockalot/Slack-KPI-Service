#!/bin/bash

# Cleanup Kubernetes resources
# Usage: ./scripts/cleanup.sh

set -e

echo "Cleaning up Kubernetes resources..."

# Delete ingress first to release load balancer
kubectl delete -f k8s/ingress.yaml --ignore-not-found=true

# Delete deployment and service
kubectl delete -f k8s/deployment.yaml --ignore-not-found=true

# Delete configmap
kubectl delete -f k8s/configmap.yaml --ignore-not-found=true

# Delete secrets
kubectl delete -f k8s/secrets.yaml --ignore-not-found=true

# Delete namespace (this will also delete everything in it)
kubectl delete -f k8s/namespace.yaml --ignore-not-found=true

echo "Kubernetes resources cleaned up!"
echo ""
echo "To destroy the GKE cluster:"
echo "  cd terraform"
echo "  terraform destroy"