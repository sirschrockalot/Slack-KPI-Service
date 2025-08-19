#!/bin/bash

# Script to set up monitoring for the Aircall Slack Service on GKS
# This script deploys Prometheus, Grafana, and Alertmanager

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
NAMESPACE="monitoring"
PROJECT_ID=${GCP_PROJECT_ID:-"presidentialdigs-dev"}

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
    
    print_success "Prerequisites check passed"
}

# Function to create monitoring namespace
create_monitoring_namespace() {
    print_status "Creating monitoring namespace..."
    
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        kubectl create namespace $NAMESPACE
        print_success "Namespace created: $NAMESPACE"
    else
        print_status "Namespace already exists: $NAMESPACE"
    fi
}

# Function to create monitoring manifests
create_monitoring_manifests() {
    print_status "Creating monitoring manifests..."
    
    # Create ConfigMap for Prometheus
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: $NAMESPACE
data:
  prometheus.yml: |
$(cat monitoring/prometheus.yml | sed 's/^/    /')
EOF

    # Create Prometheus deployment
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: $NAMESPACE
  labels:
    app: prometheus
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        - name: storage
          mountPath: /prometheus
        args:
        - '--config.file=/etc/prometheus/prometheus.yml'
        - '--storage.tsdb.path=/prometheus'
        - '--web.console.libraries=/etc/prometheus/console_libraries'
        - '--web.console.templates=/etc/prometheus/consoles'
        - '--storage.tsdb.retention.time=200h'
        - '--web.enable-lifecycle'
      volumes:
      - name: config
        configMap:
          name: prometheus-config
      - name: storage
        emptyDir: {}
EOF

    # Create Prometheus service
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: $NAMESPACE
  labels:
    app: prometheus
spec:
  type: ClusterIP
  ports:
  - port: 9090
    targetPort: 9090
    protocol: TCP
    name: http
  selector:
    app: prometheus
EOF

    # Create Grafana deployment
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: $NAMESPACE
  labels:
    app: grafana
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:latest
        ports:
        - containerPort: 3000
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          value: "admin"
        - name: GF_SECURITY_ADMIN_USER
          value: "admin"
        volumeMounts:
        - name: storage
          mountPath: /var/lib/grafana
      volumes:
      - name: storage
        emptyDir: {}
EOF

    # Create Grafana service
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: $NAMESPACE
  labels:
    app: grafana
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: grafana
EOF

    # Create Alertmanager deployment
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: $NAMESPACE
  labels:
    app: alertmanager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:latest
        ports:
        - containerPort: 9093
        volumeMounts:
        - name: config
          mountPath: /etc/alertmanager
        - name: storage
          mountPath: /alertmanager
        args:
        - '--config.file=/etc/alertmanager/alertmanager.yml'
        - '--storage.path=/alertmanager'
      volumes:
      - name: config
        configMap:
          name: alertmanager-config
      - name: storage
        emptyDir: {}
EOF

    # Create Alertmanager ConfigMap
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: $NAMESPACE
data:
  alertmanager.yml: |
$(cat monitoring/alertmanager.yml | sed 's/^/    /')
EOF

    # Create Alertmanager service
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: alertmanager
  namespace: $NAMESPACE
  labels:
    app: alertmanager
spec:
  type: ClusterIP
  ports:
  - port: 9093
    targetPort: 9093
    protocol: TCP
    name: http
  selector:
    app: alertmanager
EOF

    print_success "Monitoring manifests created"
}

# Function to create ingress for external access
create_monitoring_ingress() {
    print_status "Creating monitoring ingress..."
    
    cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: monitoring-ingress
  namespace: $NAMESPACE
  labels:
    app: monitoring
  annotations:
    kubernetes.io/ingress.class: "gce"
    cloud.google.com/load-balancer-type: "External"
spec:
  rules:
  - http:
      paths:
      - path: /prometheus
        pathType: Prefix
        backend:
          service:
            name: prometheus
            port:
              number: 9090
      - path: /grafana
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 3000
      - path: /alertmanager
        pathType: Prefix
        backend:
          service:
            name: alertmanager
            port:
              number: 9093
EOF

    print_success "Monitoring ingress created"
}

# Function to wait for monitoring to be ready
wait_for_monitoring() {
    print_status "Waiting for monitoring services to be ready..."
    
    # Wait for Prometheus
    kubectl rollout status deployment/prometheus -n $NAMESPACE --timeout=300s
    
    # Wait for Grafana
    kubectl rollout status deployment/grafana -n $NAMESPACE --timeout=300s
    
    # Wait for Alertmanager
    kubectl rollout status deployment/alertmanager -n $NAMESPACE --timeout=300s
    
    print_success "All monitoring services are ready"
}

# Function to show monitoring status
show_monitoring_status() {
    print_status "Monitoring Status:"
    echo ""
    
    kubectl get all -n $NAMESPACE
    
    echo ""
    print_status "Access URLs (after ingress is ready):"
    echo "  Prometheus: http://INGRESS_IP/prometheus"
    echo "  Grafana: http://INGRESS_IP/grafana (admin/admin)"
    echo "  Alertmanager: http://INGRESS_IP/alertmanager"
    
    echo ""
    print_status "To get the ingress IP:"
    echo "  kubectl get ingress -n $NAMESPACE"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -s, --status        Show monitoring status only"
    echo "  -i, --ingress       Create ingress for external access"
    echo ""
    echo "Examples:"
    echo "  $0                  # Full monitoring setup"
    echo "  $0 --status         # Show status only"
    echo "  $0 --ingress        # Create ingress only"
}

# Main script logic
main() {
    # Parse command line arguments
    SHOW_STATUS=false
    CREATE_INGRESS=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -s|--status)
                SHOW_STATUS=true
                shift
                ;;
            -i|--ingress)
                CREATE_INGRESS=true
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
        show_monitoring_status
        exit 0
    fi
    
    if [ "$CREATE_INGRESS" = true ]; then
        create_monitoring_ingress
        exit 0
    fi
    
    # Full monitoring setup
    create_monitoring_namespace
    create_monitoring_manifests
    wait_for_monitoring
    
    if [ "$CREATE_INGRESS" = false ]; then
        print_status "To create ingress for external access, run: $0 --ingress"
    fi
    
    show_monitoring_status
    
    print_success "🎉 Monitoring setup complete!"
    print_status "Your monitoring stack is now running on GKS!"
}

# Run main function
main "$@"
