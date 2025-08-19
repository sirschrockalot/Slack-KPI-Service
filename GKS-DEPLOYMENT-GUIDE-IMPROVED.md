# GKS Deployment Guide (Improved)

This guide explains how to deploy your Aircall-Slack service to an existing Google Kubernetes Service (GKS) cluster using GitHub Actions with improved Kubernetes manifests and deployment practices.

## 🎯 What This Does

The improved GitHub Actions workflow will:
1. **Build** your Docker image from the application code
2. **Push** the image to Google Container Registry
3. **Deploy** to your existing GKS cluster using proper Kubernetes manifests
4. **Create** services, load balancers, and auto-scaling
5. **Verify** the deployment with comprehensive health checks
6. **Provide** rollback capabilities and monitoring

## 📋 Prerequisites

### 1. Existing GKS Cluster
You need an existing GKS cluster with:
- **Cluster name** (e.g., `my-gks-cluster`)
- **Region** (e.g., `us-central1`)
- **Project ID** (e.g., `my-gcp-project-123`)

### 2. GitHub Secrets Setup

Add these secrets to your GitHub repository:

1. **GCP_PROJECT_ID**
   - Your Google Cloud Project ID
   - Example: `my-gcp-project-123`

2. **GKS_CLUSTER_NAME**
   - Your GKS cluster name
   - Example: `my-gks-cluster`

3. **GKS_CLUSTER_REGION**
   - Your GKS cluster region
   - Example: `us-central1`

4. **GCP_SA_KEY**
   - Google Cloud Service Account JSON key
   - This should be the entire JSON content of your service account key file

## 🔧 Setup Steps

### 1. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account"

# Get the service account email
SA_EMAIL=$(gcloud iam service-accounts list \
  --filter="displayName:GitHub Actions" \
  --format="value(email)")

# Grant necessary roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/container.developer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.admin"

# Create and download the key
gcloud iam service-accounts keys create ~/github-actions-key.json \
  --iam-account=$SA_EMAIL
```

### 2. Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add each secret:

   | Secret Name | Value |
   |-------------|-------|
   | `GCP_PROJECT_ID` | Your Google Cloud Project ID |
   | `GKS_CLUSTER_NAME` | Your GKS cluster name |
   | `GKS_CLUSTER_REGION` | Your GKS cluster region |
   | `GCP_SA_KEY` | Contents of `~/github-actions-key.json` |

### 3. Setup Kubernetes Secrets

Before deploying, you need to create Kubernetes secrets with your sensitive data:

#### Option A: Use the Setup Script (Recommended)

```bash
# Make sure you're connected to your GKS cluster
gcloud container clusters get-credentials YOUR_CLUSTER_NAME \
  --region YOUR_REGION \
  --project YOUR_PROJECT_ID

# Run the setup script
./scripts/setup-secrets.sh
```

The script will:
- Read from your `.env` file or environment variables
- Prompt for missing values
- Create and apply the Kubernetes secrets
- Set up the namespace

#### Option B: Manual Setup

1. **Create a `.env` file** with your configuration:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aircall-slack-agent
AIRCALL_API_ID=your_aircall_api_id
AIRCALL_API_TOKEN=your_aircall_api_token
SLACK_API_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C1234567890
JWT_SECRET=your_strong_jwt_secret
```

2. **Create and apply secrets manually**:
```bash
# Create namespace
kubectl create namespace aircall-slack

# Create secrets (replace with your actual values)
kubectl create secret generic aircall-slack-secrets \
  --from-literal=mongodb-uri="your_mongodb_uri" \
  --from-literal=aircall-api-id="your_aircall_api_id" \
  --from-literal=aircall-api-token="your_aircall_api_token" \
  --from-literal=slack-api-token="your_slack_api_token" \
  --from-literal=slack-channel-id="your_slack_channel_id" \
  --from-literal=jwt-secret="your_jwt_secret" \
  -n aircall-slack
```

## 🚀 Deployment

### Automatic Deployment
- **Push to main branch** - Automatically triggers deployment
- **Manual trigger** - Go to Actions tab and click "Run workflow"

### What Gets Deployed

The improved workflow creates:

#### Core Resources
- **Namespace**: `aircall-slack`
- **Deployment**: `aircall-slack-service` (2 replicas with rolling updates)
- **Services**: 
  - `aircall-slack-service` (ClusterIP for internal communication)
  - `aircall-slack-loadbalancer` (External LoadBalancer)

#### Advanced Features
- **Horizontal Pod Autoscaler**: Auto-scales based on CPU (70%) and memory (80%)
- **ConfigMap**: Non-sensitive configuration data
- **Secrets**: Secure storage for sensitive data
- **Health Checks**: Liveness and readiness probes
- **Security Context**: Non-root user, read-only filesystem

#### Optional Resources
- **Ingress**: For domain-based routing and SSL/TLS (commented out by default)

### Environment Variables
Your application will run with:
- `PORT=6000` (updated from 3000 to match your app)
- `NODE_ENV=production`
- All sensitive data loaded from Kubernetes secrets
- Configuration from ConfigMap

## 📊 Monitoring and Management

### Check Deployment Status
```bash
# Get cluster credentials
gcloud container clusters get-credentials YOUR_CLUSTER_NAME \
  --region YOUR_REGION \
  --project YOUR_PROJECT_ID

# Check all resources
kubectl get all -n aircall-slack

# Check pods
kubectl get pods -n aircall-slack

# Check services
kubectl get services -n aircall-slack

# Check HPA
kubectl get hpa -n aircall-slack

# Check logs
kubectl logs -n aircall-slack -l app=aircall-slack-service -f
```

### Access Your Application
After deployment, get the external IP:
```bash
kubectl get service aircall-slack-loadbalancer -n aircall-slack
```

Your application will be available at: `http://EXTERNAL_IP/health`

### Scaling
```bash
# Manual scaling
kubectl scale deployment aircall-slack-service --replicas=3 -n aircall-slack

# Check HPA status
kubectl describe hpa aircall-slack-hpa -n aircall-slack
```

## 🔄 Updates and Rollbacks

### Deploy New Version
1. **Make changes** to your code
2. **Push to main branch** - Automatic deployment
3. **Or manually trigger** the workflow

### Rollback
```bash
# Check rollout history
kubectl rollout history deployment/aircall-slack-service -n aircall-slack

# Rollback to previous version
kubectl rollout undo deployment/aircall-slack-service -n aircall-slack

# Rollback to specific revision
kubectl rollout undo deployment/aircall-slack-service --to-revision=2 -n aircall-slack

# Check rollout status
kubectl rollout status deployment/aircall-slack-service -n aircall-slack
```

## 🛠️ Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify `GCP_SA_KEY` secret is correct
   - Ensure service account has proper permissions

2. **Cluster Not Found**
   - Check `GKS_CLUSTER_NAME` and `GKS_CLUSTER_REGION` secrets
   - Verify cluster exists in your project

3. **Image Build Failures**
   - Check Dockerfile syntax
   - Verify all dependencies are in package.json

4. **Deployment Failures**
   - Check pod logs: `kubectl logs -n aircall-slack -l app=aircall-slack-service`
   - Verify secrets exist: `kubectl get secrets -n aircall-slack`
   - Check pod events: `kubectl describe pod -n aircall-slack -l app=aircall-slack-service`

5. **Secrets Not Found**
   - Run the setup script: `./scripts/setup-secrets.sh`
   - Or manually create secrets as shown above

### Debug Commands

```bash
# Check pod status
kubectl describe pod -n aircall-slack -l app=aircall-slack-service

# Check service endpoints
kubectl get endpoints -n aircall-slack

# Check events
kubectl get events -n aircall-slack --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n aircall-slack

# Check HPA status
kubectl describe hpa -n aircall-slack
```

## 🔐 Security Features

### Built-in Security
- **Non-root user**: Application runs as user 1001
- **Read-only filesystem**: Container filesystem is read-only
- **Dropped capabilities**: All Linux capabilities are dropped
- **Secrets management**: Sensitive data stored in Kubernetes secrets
- **Network policies**: Configurable network access control

### Best Practices
- **Rotate service account keys** regularly
- **Use least privilege** for service account permissions
- **Monitor access logs** in Google Cloud Console
- **Keep Docker images updated** with security patches
- **Regular security audits** of your cluster

## 📈 Performance and Scaling

### Resource Limits
- **CPU**: 200m request, 500m limit
- **Memory**: 256Mi request, 512Mi limit

### Auto-scaling
- **Min replicas**: 2
- **Max replicas**: 10
- **CPU threshold**: 70%
- **Memory threshold**: 80%

### Scaling Behavior
- **Scale up**: Aggressive (100% increase, 2 pods max)
- **Scale down**: Conservative (10% decrease, 1 pod max)
- **Stabilization**: 60s up, 300s down

## 🌐 Ingress and Domain Setup (Optional)

To use a custom domain with SSL/TLS:

1. **Update the ingress.yaml**:
   - Replace `your-domain.com` with your actual domain
   - Uncomment SSL/TLS sections if using cert-manager

2. **Apply the ingress**:
```bash
kubectl apply -f k8s/ingress.yaml
```

3. **Configure DNS**:
   - Point your domain to the ingress IP
   - Wait for SSL certificate provisioning

## 🎉 Success!

When deployment is successful, you should see:
- ✅ All workflow steps completed
- ✅ Pods running in GKS cluster (2 replicas)
- ✅ Load balancer IP assigned
- ✅ Health check passing
- ✅ HPA configured and working
- ✅ Application accessible via external IP
- ✅ Prometheus metrics available at `/metrics`

Your Aircall-Slack service is now running on GKS with production-grade configuration! 🚀

## 📚 Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Google Cloud GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Prometheus Monitoring](https://prometheus.io/docs/)
