#!/bin/bash

# Script to deploy the Aircall Slack Service to GKS
# This script can be used for manual deployment or testing

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

# Configuration
NAMESPACE="aircall-slack"
PROJECT_ID=${GCP_PROJECT_ID:-""}
CLUSTER_NAME=${GKS_CLUSTER_NAME:-""}
CLUSTER_REGION=${GKS_CLUSTER_REGION:-""}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we're connected to a cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Not connected to a Kubernetes cluster"
        print_status "Please run: gcloud container clusters get-credentials YOUR_CLUSTER_NAME --region YOUR_REGION --project YOUR_PROJECT_ID"
        exit 1
    fi
    
    # Check if secrets exist
    if ! kubectl get secret aircall-slack-secrets -n $NAMESPACE &> /dev/null; then
        print_warning "Secrets not found. Please run ./scripts/setup-secrets.sh first"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to deploy the application
deploy_application() {
    print_status "Deploying Aircall Slack Service to GKS..."
    
    # Apply manifests in order
    print_status "Applying namespace..."
    kubectl apply -f k8s/namespace.yaml
    
    print_status "Applying configmap..."
    kubectl apply -f k8s/configmap.yaml
    
    print_status "Applying deployment..."
    kubectl apply -f k8s/deployment.yaml
    
    print_status "Applying services..."
    kubectl apply -f k8s/service.yaml
    
    print_status "Applying HPA..."
    kubectl apply -f k8s/hpa.yaml
    
    print_success "All manifests applied successfully"
}

# Function to wait for deployment
wait_for_deployment() {
    print_status "Waiting for deployment to complete..."
    
    kubectl rollout status deployment/aircall-slack-service -n $NAMESPACE --timeout=300s
    
    if [ $? -eq 0 ]; then
        print_success "Deployment completed successfully"
    else
        print_error "Deployment failed or timed out"
        exit 1
    fi
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    echo ""
    echo "=== Pod Status ==="
    kubectl get pods -n $NAMESPACE -l app=aircall-slack-service
    
    echo ""
    echo "=== Service Status ==="
    kubectl get services -n $NAMESPACE
    
    echo ""
    echo "=== HPA Status ==="
    kubectl get hpa -n $NAMESPACE
    
    echo ""
    echo "=== Secrets Status ==="
    kubectl get secrets -n $NAMESPACE
}

# Function to get service URL
get_service_url() {
    print_status "Getting service URL..."
    
    # Wait for load balancer to be ready
    print_status "Waiting for load balancer to be ready..."
    sleep 30
    
    # Get the load balancer IP
    LB_IP=$(kubectl get service aircall-slack-loadbalancer -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [ -n "$LB_IP" ]; then
        print_success "Service URL: http://$LB_IP"
        echo ""
        echo "🌐 Your application is available at:"
        echo "   http://$LB_IP"
        echo "   http://$LB_IP/health (health check)"
        echo "   http://$LB_IP/api-docs (API documentation)"
        echo "   http://$LB_IP/metrics (Prometheus metrics)"
    else
        print_warning "Load balancer IP not yet available"
        print_status "You can check the status with: kubectl get service aircall-slack-loadbalancer -n $NAMESPACE"
    fi
}

# Function to perform health check
health_check() {
    print_status "Performing health check..."
    
    # Wait a bit more for the service to be ready
    sleep 30
    
    # Get the load balancer IP
    LB_IP=$(kubectl get service aircall-slack-loadbalancer -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    
    if [ -n "$LB_IP" ]; then
        print_status "Testing health endpoint at http://$LB_IP/health"
        
        # Try health check multiple times
        for i in {1..5}; do
            if curl -f -s http://$LB_IP/health > /dev/null; then
                print_success "Health check passed on attempt $i"
                break
            else
                print_warning "Health check failed on attempt $i, retrying..."
                sleep 10
            fi
            
            if [ $i -eq 5 ]; then
                print_error "Health check failed after 5 attempts"
                exit 1
            fi
        done
    else
        print_warning "Load balancer IP not available yet"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -v, --verify-only   Only verify deployment, don't deploy"
    echo "  -s, --status        Show deployment status"
    echo "  -r, --rollback      Rollback to previous version"
    echo ""
    echo "Examples:"
    echo "  $0                  # Full deployment"
    echo "  $0 --verify-only    # Only verify"
    echo "  $0 --status         # Show status"
    echo "  $0 --rollback       # Rollback deployment"
}

# Function to show deployment status
show_status() {
    print_status "Deployment Status:"
    echo ""
    
    kubectl get all -n $NAMESPACE
    
    echo ""
    print_status "Recent events:"
    kubectl get events -n $NAMESPACE --sort-by='.lastTimestamp' | tail -10
}

# Function to rollback deployment
rollback_deployment() {
    print_status "Rolling back deployment..."
    
    # Check rollout history
    echo "Rollout history:"
    kubectl rollout history deployment/aircall-slack-service -n $NAMESPACE
    
    # Rollback to previous version
    kubectl rollout undo deployment/aircall-slack-service -n $NAMESPACE
    
    # Wait for rollback to complete
    print_status "Waiting for rollback to complete..."
    kubectl rollout status deployment/aircall-slack-service -n $NAMESPACE --timeout=300s
    
    if [ $? -eq 0 ]; then
        print_success "Rollback completed successfully"
    else
        print_error "Rollback failed or timed out"
        exit 1
    fi
}

# Main script logic
main() {
    # Parse command line arguments
    VERIFY_ONLY=false
    SHOW_STATUS=false
    ROLLBACK=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verify-only)
                VERIFY_ONLY=true
                shift
                ;;
            -s|--status)
                SHOW_STATUS=true
                shift
                ;;
            -r|--rollback)
                ROLLBACK=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    
    if [ "$SHOW_STATUS" = true ]; then
        show_status
        exit 0
    fi
    
    if [ "$ROLLBACK" = true ]; then
        rollback_deployment
        exit 0
    fi
    
    if [ "$VERIFY_ONLY" = true ]; then
        verify_deployment
        get_service_url
        health_check
        exit 0
    fi
    
    # Full deployment
    deploy_application
    wait_for_deployment
    verify_deployment
    get_service_url
    health_check
    
    print_success "🎉 Deployment complete!"
    print_status "Your Aircall Slack Service is now running on GKS!"
}

# Run main function
main "$@"
