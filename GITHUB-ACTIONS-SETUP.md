# GitHub Actions Setup Guide (Workload Identity)

This guide explains how to configure GitHub Actions to automatically deploy your Aircall Slack Service to GKS using **Workload Identity** - the most secure authentication method.

## 🔐 Required GitHub Secrets

You need to add these secrets to your GitHub repository:

### 1. **GCP_PROJECT_ID**
- **Value**: `presidentialdigs-dev`
- **Description**: Your Google Cloud Project ID

### 2. **GKS_CLUSTER_NAME**
- **Value**: `dev-cluster`
- **Description**: Your GKS cluster name

### 3. **GKS_CLUSTER_REGION**
- **Value**: `us-central1`
- **Description**: Your GKS cluster region

### 4. **WORKLOAD_IDENTITY_PROVIDER** ⭐ **NEW**
- **Value**: `projects/139931184497/locations/global/workloadIdentityPools/github-actions-pool/providers/slack-kpi-provider`
- **Description**: Your Workload Identity provider for GitHub Actions

### 5. **GCP_SERVICE_ACCOUNT** ⭐ **NEW**
- **Value**: `github-actions-sa@presidentialdigs-dev.iam.gserviceaccount.com`
- **Description**: Your Google Cloud service account email

### 6. **GCP_SA_KEY** ❌ **NOT NEEDED**
- **Status**: ❌ **No longer required with Workload Identity**
- **Description**: Workload Identity handles authentication automatically

## 🚀 **Workload Identity is Already Configured!**

Great news! Your Workload Identity is already set up and configured. The GitHub Actions workflow will authenticate automatically using:

- **Pool**: `github-actions-pool`
- **Provider**: `slack-kpi-provider`
- **Service Account**: `github-actions-sa@presidentialdigs-dev.iam.gserviceaccount.com`
- **Repository**: `sirschrockalot/Slack-KPI-Service`

## 🔧 Setup Steps

### Step 1: Add GitHub Secrets

1. Go to your GitHub repository: `https://github.com/sirschrockalot/Slack-KPI-Service`
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Add these secrets:

   | Secret Name | Value |
   |-------------|-------|
   | `GCP_PROJECT_ID` | `presidentialdigs-dev` |
   | `GKS_CLUSTER_NAME` | `dev-cluster` |
   | `GKS_CLUSTER_REGION` | `us-central1` |
   | `WORKLOAD_IDENTITY_PROVIDER` | `projects/139931184497/locations/global/workloadIdentityPools/github-actions-pool/providers/slack-kpi-provider` |
   | `GCP_SERVICE_ACCOUNT` | `github-actions-sa@presidentialdigs-dev.iam.gserviceaccount.com` |

### Step 2: Verify Workload Identity Configuration

Your Workload Identity is already configured with:

```bash
# Pool: github-actions-pool
# Provider: slack-kpi-provider  
# Service Account: github-actions-sa@presidentialdigs-dev.iam.gserviceaccount.com
# Repository: sirschrockalot/Slack-KPI-Service
```

### Step 3: Test the Workflow

1. **Push to main branch** - Automatically triggers deployment
2. **Manual trigger** - Go to Actions tab and click "Run workflow"

## 🎯 How Workload Identity Works

### **Traditional Method (Service Account Keys)**
```
GitHub Actions → Service Account Key → Google Cloud
```

### **Workload Identity (Modern & Secure)**
```
GitHub Actions → OIDC Token → Workload Identity → Google Cloud
```

**Benefits:**
- ✅ **No long-lived credentials** stored in GitHub
- ✅ **Automatic token rotation**
- ✅ **Repository-scoped access**
- ✅ **Audit trail for all actions**
- ✅ **Compliance with security policies**

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify repository name matches exactly: `sirschrockalot/Slack-KPI-Service`
   - Check if Workload Identity provider is active
   - Ensure service account has proper permissions

2. **Permission Denied**
   - Verify service account has required roles:
     - `roles/container.developer` (GKS access)
     - `roles/storage.admin` (Artifact Registry)
     - `roles/artifactregistry.writer` (Image push)
     - `roles/iam.serviceAccountUser` (Service account usage)

### Debug Commands

```bash
# Check Workload Identity pool
gcloud iam workload-identity-pools describe github-actions-pool \
  --location=global --project=presidentialdigs-dev

# Check Workload Identity provider
gcloud iam workload-identity-pools providers describe slack-kpi-provider \
  --workload-identity-pool=github-actions-pool \
  --location=global --project=presidentialdigs-dev

# Check service account bindings
gcloud iam service-accounts get-iam-policy \
  github-actions-sa@presidentialdigs-dev.iam.gserviceaccount.com \
  --project=presidentialdigs-dev
```

## 🔐 Security Features

### **Repository Scoping**
- Only `sirschrockalot/Slack-KPI-Service` can use this identity
- Other repositories cannot access your GCP resources

### **Automatic Token Rotation**
- Tokens are generated fresh for each workflow run
- No long-lived credentials to manage or rotate

### **Audit Logging**
- All authentication events are logged in Cloud Audit Logs
- Track who accessed what and when

## 📚 Additional Resources

- [Workload Identity Documentation](https://cloud.google.com/iam/docs/workload-identity)
- [GitHub Actions with Workload Identity](https://github.com/google-github-actions/auth#workload-identity-federation)
- [Google Cloud IAM Documentation](https://cloud.google.com/iam/docs)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)

## 🎉 Success!

When properly configured, your GitHub Actions workflow will:
- ✅ **Authenticate automatically** using Workload Identity
- ✅ **Build and push Docker images** to Artifact Registry
- ✅ **Deploy to GKS** with manual approval
- ✅ **Perform health checks** and verification
- ✅ **Provide detailed deployment summaries**
- ✅ **Support rollbacks and monitoring**

Your Aircall Slack Service now has **secure, automated CI/CD deployment** to GKS using modern authentication! 🚀

## 🔄 **Migration from Service Account Keys**

If you previously used service account keys:

1. **Remove the `GCP_SA_KEY` secret** from GitHub
2. **The workflow automatically uses Workload Identity**
3. **No other changes needed**

The migration is seamless and more secure! 🎯
