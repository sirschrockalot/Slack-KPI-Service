# GKS Deployment Guide

This guide explains how to deploy your Aircall-Slack service to an existing Google Kubernetes Service (GKS) cluster using GitHub Actions.

## 🎯 What This Does

The GitHub Actions workflow will:
1. **Build** your Docker image from the application code
2. **Push** the image to Google Container Registry
3. **Deploy** to your existing GKS cluster
4. **Create** a load balancer to expose your service
5. **Verify** the deployment with health checks

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

## 🚀 Deployment

### Automatic Deployment
- **Push to main branch** - Automatically triggers deployment
- **Manual trigger** - Go to Actions tab and click "Run workflow"

### What Gets Deployed

The workflow creates:
- **Namespace**: `aircall-slack`
- **Deployment**: `aircall-slack-service`
- **Service**: `aircall-slack-service` (ClusterIP)
- **Load Balancer**: `aircall-slack-loadbalancer` (External)

### Environment Variables
Your application will run with:
- `PORT=3000`
- `NODE_ENV=production`

## 📊 Monitoring

### Check Deployment Status
```bash
# Get cluster credentials
gcloud container clusters get-credentials YOUR_CLUSTER_NAME \
  --region YOUR_REGION \
  --project YOUR_PROJECT_ID

# Check pods
kubectl get pods -n aircall-slack

# Check services
kubectl get services -n aircall-slack

# Check logs
kubectl logs -n aircall-slack -l app=aircall-slack-service -f
```

### Access Your Application
After deployment, get the external IP:
```bash
kubectl get service aircall-slack-loadbalancer -n aircall-slack
```

Your application will be available at: `http://EXTERNAL_IP/health`

## 🔄 Updates

### Deploy New Version
1. **Make changes** to your code
2. **Push to main branch** - Automatic deployment
3. **Or manually trigger** the workflow

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/aircall-slack-service -n aircall-slack

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
   - Verify environment variables are correct

### Debug Commands

```bash
# Check pod status
kubectl describe pod -n aircall-slack -l app=aircall-slack-service

# Check service endpoints
kubectl get endpoints -n aircall-slack

# Check events
kubectl get events -n aircall-slack --sort-by='.lastTimestamp'
```

## 📈 Scaling

### Scale Up/Down
```bash
# Scale to 3 replicas
kubectl scale deployment aircall-slack-service --replicas=3 -n aircall-slack

# Scale to 1 replica
kubectl scale deployment aircall-slack-service --replicas=1 -n aircall-slack
```

### Auto Scaling
To enable auto-scaling:
```bash
kubectl autoscale deployment aircall-slack-service \
  --cpu-percent=70 \
  --min=1 \
  --max=5 \
  -n aircall-slack
```

## 🔐 Security

### Best Practices
- **Rotate service account keys** regularly
- **Use least privilege** for service account permissions
- **Monitor access logs** in Google Cloud Console
- **Keep Docker images updated** with security patches

### Network Policies
Consider implementing network policies for additional security:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: aircall-slack-network-policy
  namespace: aircall-slack
spec:
  podSelector:
    matchLabels:
      app: aircall-slack-service
  policyTypes:
  - Ingress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: aircall-slack
    ports:
    - protocol: TCP
      port: 3000
```

## 🎉 Success!

When deployment is successful, you should see:
- ✅ All workflow steps completed
- ✅ Pods running in GKS cluster
- ✅ Load balancer IP assigned
- ✅ Health check passing
- ✅ Application accessible via external IP

Your Aircall-Slack service is now running on GKS! 🚀 