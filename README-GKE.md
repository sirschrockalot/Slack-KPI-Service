# GKE Deployment Guide

This guide will help you deploy the Aircall-Slack service to Google Kubernetes Engine (GKE) using Terraform for infrastructure management.

## Prerequisites

1. **Google Cloud SDK**: Install and authenticate
   ```bash
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   gcloud auth login
   gcloud auth application-default login
   ```

2. **Terraform**: Install Terraform
   ```bash
   # On macOS
   brew install terraform
   
   # On Ubuntu/Debian
   wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
   echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
   sudo apt update && sudo apt install terraform
   ```

3. **kubectl**: Install Kubernetes CLI
   ```bash
   gcloud components install kubectl
   ```

4. **Docker**: For building images
   ```bash
   # Install Docker based on your OS
   # Ensure Docker is running
   ```

## Cost Optimization Features

This setup uses several cost optimization strategies:

- **Preemptible VMs**: Up to 80% cost savings
- **Small machine types**: e2-small instances
- **Minimal disk size**: 20GB standard persistent disks
- **Auto-scaling**: Scale down to 1 node when not in use
- **Regional cluster**: No zonal redundancy for development
- **Minimal logging/monitoring**: Only essential components

**Estimated monthly cost**: $15-30 USD (depending on usage)

## Setup Instructions

### 1. Configure GCP Project

```bash
# Set your project ID
export GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Enable billing (required for GKE)
# Make sure billing is enabled in the GCP Console
```

### 2. Configure Terraform

```bash
cd terraform

# Copy and edit the variables file
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update with your project ID and preferences

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply
```

### 3. Configure kubectl

```bash
# Get cluster credentials
gcloud container clusters get-credentials aircall-slack-cluster --region us-central1

# Verify connection
kubectl cluster-info
```

### 4. Build and Push Docker Image

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Build and push image to Google Container Registry
./scripts/build-and-push.sh your-gcp-project-id latest
```

### 5. Configure Secrets

```bash
# Copy and edit secrets file
cp k8s/secrets.yaml.example k8s/secrets.yaml

# Update with your actual values (base64 encoded)
nano k8s/secrets.yaml

# Encode secrets (example):
echo -n "your-aircall-api-key" | base64
echo -n "your-slack-webhook-url" | base64
```

### 6. Deploy Application

```bash
# Deploy to Kubernetes
./scripts/deploy.sh your-gcp-project-id latest

# Check deployment status
kubectl get pods -n aircall-slack
kubectl get services -n aircall-slack
kubectl get ingress -n aircall-slack
```

### 7. Access Your Application

```bash
# Get external IP
kubectl get service aircall-slack-loadbalancer -n aircall-slack

# Check logs
kubectl logs -n aircall-slack -l app=aircall-slack-service -f
```

## Useful Commands

### Monitoring and Debugging

```bash
# View pods
kubectl get pods -n aircall-slack

# Describe a pod
kubectl describe pod <pod-name> -n aircall-slack

# View logs
kubectl logs -n aircall-slack -l app=aircall-slack-service -f

# Execute into a pod
kubectl exec -it <pod-name> -n aircall-slack -- /bin/sh

# Check service endpoints
kubectl get endpoints -n aircall-slack
```

### Scaling

```bash
# Scale deployment
kubectl scale deployment aircall-slack-service --replicas=2 -n aircall-slack

# Check horizontal pod autoscaler
kubectl get hpa -n aircall-slack
```

### Updates

```bash
# Update image
kubectl set image deployment/aircall-slack-service aircall-slack-service=gcr.io/$GOOGLE_CLOUD_PROJECT/aircall-slack-service:new-tag -n aircall-slack

# Check rollout status
kubectl rollout status deployment/aircall-slack-service -n aircall-slack

# Rollback if needed
kubectl rollout undo deployment/aircall-slack-service -n aircall-slack
```

## Domain Setup (Optional)

If you want to use a custom domain:

1. **Reserve a static IP**:
   ```bash
   gcloud compute addresses create aircall-slack-ip --global
   ```

2. **Update DNS**: Point your domain to the reserved IP

3. **Update ingress.yaml**: Replace `your-domain.com` with your actual domain

4. **Apply changes**:
   ```bash
   kubectl apply -f k8s/ingress.yaml
   ```

## Cleanup

### Remove Kubernetes Resources

```bash
./scripts/cleanup.sh
```

### Destroy Infrastructure

```bash
cd terraform
terraform destroy
```

## Troubleshooting

### Common Issues

1. **Image pull errors**: Ensure the image exists in GCR and permissions are correct
2. **Pod startup failures**: Check logs and resource limits
3. **Service not accessible**: Verify ingress and service configurations
4. **Costs higher than expected**: Check for unexpected resources in GCP Console

### Getting Help

```bash
# Check cluster status
kubectl cluster-info
kubectl get nodes

# Check all resources in namespace
kubectl get all -n aircall-slack

# Describe problematic resources
kubectl describe <resource-type> <resource-name> -n aircall-slack
```

## Security Considerations

1. **Secrets Management**: Never commit secrets to version control
2. **Network Policies**: Consider implementing network policies for production
3. **RBAC**: Implement proper role-based access control
4. **Image Security**: Regularly update base images and scan for vulnerabilities

## Cost Monitoring

Monitor your costs in the GCP Console:
1. Go to Billing → Reports
2. Filter by service (Kubernetes Engine, Compute Engine)
3. Set up budget alerts
4. Use preemptible instances for non-critical workloads

## Next Steps

1. Set up monitoring with Google Cloud Operations
2. Implement proper backup strategies
3. Set up CI/CD pipelines
4. Configure auto-scaling based on metrics
5. Implement proper security policies