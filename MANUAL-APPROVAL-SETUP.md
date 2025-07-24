# Manual Approval Setup for GKS Deployment

This guide explains how to set up manual approval for your GKS deployments using GitHub Environments.

## 🎯 Overview

The new workflow `deploy-to-gks-with-approval.yml` includes a manual approval step that requires you to approve deployments before they go to your GKS cluster.

## 📋 Setup Steps

### 1. Create GitHub Environment

1. Go to your GitHub repository
2. Navigate to **Settings** > **Environments**
3. Click **New environment**
4. Name it `production`
5. Configure the environment:

#### **Protection Rules**
- ✅ **Required reviewers**: Add yourself or team members who can approve
- ✅ **Wait timer**: Set to 0 (optional, for immediate approval)
- ✅ **Deployment branches**: Restrict to `main` branch only

#### **Environment Secrets** (if needed)
- `GCP_PROJECT_ID`
- `GKS_CLUSTER_NAME`
- `GKS_CLUSTER_REGION`
- `GCP_SA_KEY`

### 2. Workflow Process

The workflow now has **3 stages**:

#### **Stage 1: Build and Prepare**
- ✅ Builds Docker image
- ✅ Pushes to Google Container Registry
- ✅ Creates deployment summary
- ✅ Shows what changes will be deployed

#### **Stage 2: Manual Approval**
- ⏸️ **Pauses** and waits for your approval
- 📧 **Sends notification** to reviewers
- 🔍 **Shows deployment details** for review

#### **Stage 3: Deploy to GKS**
- 🚀 **Only runs after approval**
- ✅ Deploys to your GKS cluster
- ✅ Performs health checks
- ✅ Reports deployment status

## 🔧 How to Use

### **Automatic Trigger**
When you push to main branch:
1. **Build stage** runs automatically
2. **Approval stage** pauses and notifies reviewers
3. **You approve** the deployment
4. **Deploy stage** runs and deploys to GKS

### **Manual Trigger**
1. Go to **Actions** tab
2. Select **"Deploy to GKS (with Approval)"** workflow
3. Click **"Run workflow"**
4. Follow the same approval process

### **Approval Process**
1. **Receive notification** (email or GitHub notification)
2. **Review deployment details**:
   - Image being deployed
   - Commit changes
   - Author information
3. **Click "Review deployments"** in the workflow
4. **Approve or reject** the deployment
5. **Add comments** if needed

## 📊 What You'll See

### **Before Approval**
```
🚀 Deployment Ready for Approval
Image Built: gcr.io/your-project/aircall-slack-service:abc123
Commit: abc123def456
Branch: main
Author: your-username

Changes to be deployed:
abc123 Update API endpoint
def456 Fix authentication bug
ghi789 Add new feature
```

### **After Approval**
```
✅ Approved for Deployment
Approved by: your-username
Approved at: 2024-01-15 10:30:00
Image: gcr.io/your-project/aircall-slack-service:abc123
```

### **After Deployment**
```
🎉 Deployment Complete!
Status: ✅ Successfully deployed to GKS
Image: gcr.io/your-project/aircall-slack-service:abc123
Service URL: http://34.123.45.67
Deployed at: 2024-01-15 10:35:00
```

## 🔐 Security Benefits

### **Control Over Deployments**
- ✅ **No automatic deployments** to production
- ✅ **Review all changes** before deployment
- ✅ **Audit trail** of who approved what
- ✅ **Rollback capability** if needed

### **Team Collaboration**
- ✅ **Multiple reviewers** can be added
- ✅ **Comments and discussions** on deployments
- ✅ **Clear approval process** for team members

## 🛠️ Configuration Options

### **Environment Settings**

#### **Required Reviewers**
Add team members who can approve:
- Go to **Settings** > **Environments** > **production**
- Add reviewers under **"Required reviewers"**

#### **Branch Restrictions**
Limit which branches can deploy:
- **Deployment branches**: `main` (recommended)
- **Branch protection**: Enable branch protection rules

#### **Wait Timer**
Add delay before approval:
- **Wait timer**: Set to minutes (e.g., 5 minutes)
- Useful for emergency deployments

### **Customization**

#### **Add More Reviewers**
```yaml
# In environment settings
Required reviewers:
- your-username
- team-member-1
- team-member-2
```

#### **Branch Protection**
```yaml
# In repository settings
Branch protection rules:
- Require pull request reviews
- Require status checks to pass
- Include administrators
```

## 📱 Notifications

### **Email Notifications**
- **Review requests** sent to required reviewers
- **Deployment status** updates
- **Approval confirmations**

### **GitHub Notifications**
- **In-app notifications** for approval requests
- **Workflow status** updates
- **Deployment summaries**

## 🔄 Workflow Comparison

### **Old Workflow** (`deploy-to-gks.yml`)
- ✅ Build and deploy immediately
- ❌ No approval required
- ❌ No review process

### **New Workflow** (`deploy-to-gks-with-approval.yml`)
- ✅ Build and prepare
- ✅ **Manual approval required**
- ✅ Review and audit trail
- ✅ Deploy after approval

## 🚨 Emergency Deployments

### **Bypass Approval** (if needed)
1. **Temporarily disable** environment protection
2. **Use old workflow** for immediate deployment
3. **Re-enable protection** after emergency

### **Quick Approval**
- **Set wait timer to 0** for immediate approval
- **Add yourself as sole reviewer** for quick access
- **Use manual trigger** for controlled deployments

## 📈 Best Practices

### **Review Process**
1. **Check commit messages** for clarity
2. **Review code changes** in the commit
3. **Verify image details** are correct
4. **Test in staging** before production approval

### **Team Coordination**
1. **Communicate deployments** to team
2. **Use descriptive commit messages**
3. **Add deployment notes** in approval comments
4. **Monitor deployment status** after approval

## 🎉 Success!

With manual approval set up, you now have:
- ✅ **Full control** over when deployments happen
- ✅ **Review process** for all changes
- ✅ **Audit trail** of approvals
- ✅ **Team collaboration** on deployments
- ✅ **Emergency procedures** when needed

Your GKS deployments are now secure and controlled! 🚀 