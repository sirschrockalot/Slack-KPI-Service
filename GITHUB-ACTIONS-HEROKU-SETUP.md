# GitHub Actions + Heroku Setup Guide

This guide will help you set up automated deployment to Heroku using GitHub Actions, giving you the same CI/CD experience you had with GKS but now for Heroku.

## 🚀 Overview

With this setup, you'll get:
- ✅ **Automated testing** on every push and pull request
- ✅ **Automatic deployment** to Heroku on main branch pushes
- ✅ **Health checks** and verification after deployment
- ✅ **Post-deployment testing** of API endpoints
- ✅ **Deployment summaries** with useful information
- ✅ **Manual workflow triggers** for setup and configuration

## 📋 Prerequisites

1. **GitHub Repository**: Your code must be in a GitHub repository
2. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
3. **Heroku API Key**: Generate from [Heroku Account Settings](https://dashboard.heroku.com/account)
4. **GitHub Secrets**: Configure the required secrets (see below)

## 🔧 Step 1: Configure GitHub Secrets

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add these secrets:

### Required Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `HEROKU_API_KEY` | Your Heroku API key | `12345678-1234-1234-1234-123456789abc` |
| `HEROKU_EMAIL` | Your Heroku account email | `your-email@example.com` |
| `HEROKU_APP_NAME` | Your Heroku app name | `your-slack-kpi-service` |

### Optional Secrets (for API testing)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `AIRCALL_API_ID` | Aircall API ID | `your-aircall-api-id` |
| `AIRCALL_API_TOKEN` | Aircall API Token | `your-aircall-api-token` |
| `SLACK_API_TOKEN` | Slack Bot Token | `xoxb-your-slack-bot-token` |
| `SLACK_CHANNEL_ID` | Slack Channel ID | `your-slack-channel-id` |
| `JWT_SECRET` | JWT Secret for API auth | `your-secret-key-here` |

## 🏗️ Step 2: Initial Heroku App Setup

### Option A: Using GitHub Actions (Recommended)

1. Go to your GitHub repository → **Actions** tab
2. Select **"Setup Heroku App"** workflow
3. Click **"Run workflow"**
4. Enter your app name and select **"setup"** action
5. Click **"Run workflow"**

This will:
- Create your Heroku app (if it doesn't exist)
- Add MongoDB add-on
- Configure Git remote

### Option B: Manual Setup

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add MongoDB add-on
heroku addons:create mongolab:sandbox

# Add Git remote
heroku git:remote -a your-app-name
```

## ⚙️ Step 3: Configure Environment Variables

### Option A: Using GitHub Actions

1. Go to **Actions** → **"Setup Heroku App"** workflow
2. Click **"Run workflow"**
3. Enter your app name and select **"configure"** action
4. Click **"Run workflow"**

This will set all environment variables from your GitHub secrets.

### Option B: Manual Configuration

```bash
# Set required variables
heroku config:set AIRCALL_API_ID=your_api_id
heroku config:set AIRCALL_API_TOKEN=your_api_token
heroku config:set SLACK_API_TOKEN=xoxb-your-slack-token
heroku config:set SLACK_CHANNEL_ID=C1234567890
heroku config:set JWT_SECRET=your_jwt_secret

# Set default variables
heroku config:set NODE_ENV=production
heroku config:set PORT=6000
heroku config:set EXCLUDED_USERS="Joel Schrock,Test User"
heroku config:set AFTERNOON_REPORT_TIME=19:34
heroku config:set NIGHT_REPORT_TIME=22:00
heroku config:set TZ=America/Chicago
heroku config:set ENABLE_SWAGGER=true
heroku config:set ENABLE_METRICS=true
heroku config:set LOG_LEVEL=info
```

## 🚀 Step 4: Deploy Your App

### Automatic Deployment

Once configured, every push to your `main` or `master` branch will automatically:

1. **Run tests** on multiple Node.js versions
2. **Check code quality** (Procfile, app.json, etc.)
3. **Deploy to Heroku** using the Heroku deploy action
4. **Verify deployment** with health checks
5. **Run post-deployment tests** (if JWT_SECRET is available)
6. **Generate deployment summary** with useful information

### Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** → **"Deploy to Heroku"** workflow
2. Click **"Run workflow"**
3. Select your branch and click **"Run workflow"**

## 📊 Workflow Details

### Test Job

Runs on every push and pull request:
- ✅ **Multi-version testing**: Node.js 18.x and 20.x
- ✅ **Dependency installation**: `npm ci`
- ✅ **Test execution**: `npm test`
- ✅ **Code quality checks**: Verifies Procfile, app.json, package-lock.json

### Deploy Job

Runs only on main/master branch pushes:
- ✅ **Automatic deployment**: Uses Heroku deploy action
- ✅ **Health verification**: Tests health endpoint after deployment
- ✅ **Rollback protection**: Automatically rolls back if health check fails
- ✅ **Post-deployment testing**: Tests API endpoints with JWT authentication
- ✅ **Deployment summary**: Generates comprehensive deployment report

## 🔍 Monitoring and Verification

### GitHub Actions

- **Workflow runs**: View in Actions tab
- **Deployment logs**: Detailed logs for each step
- **Deployment summary**: Summary with app URLs and commands

### Heroku

- **App status**: `heroku ps --app your-app-name`
- **Logs**: `heroku logs --tail --app your-app-name`
- **Environment**: `heroku config --app your-app-name`

## 🧪 Testing Your Deployment

### Health Check

```bash
curl https://your-app-name.herokuapp.com/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2025-08-26T18:43:17.196Z","service":"aircall-slack-agent"}
```

### API Endpoints

Generate JWT token:
```bash
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({user: 'test'}, 'your_jwt_secret'));"
```

Test API:
```bash
curl -X POST https://your-app-name.herokuapp.com/report/afternoon \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 🔧 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all dependencies are in `package.json`
   - Verify `package-lock.json` exists
   - Ensure `Procfile` and `app.json` are present

2. **Deployment Failures**
   - Verify Heroku API key and email are correct
   - Check that the app name exists
   

3. **Health Check Failures**
   - Check Heroku logs: `heroku logs --tail`
   - Verify environment variables are set
   

4. **Environment Variable Issues**
   - Run the setup workflow with "configure" action
   - Manually verify with `heroku config`
   - Check GitHub secrets are properly set

### Debug Commands

```bash
# Check app status
heroku ps --app your-app-name

# View recent logs
heroku logs --app your-app-name

# Check environment variables
heroku config --app your-app-name

# Restart the app
heroku restart --app your-app-name

# Check add-ons
heroku addons --app your-app-name
```

## 📈 Advanced Features

### Manual Workflow Triggers

- **Setup workflow**: Create/configure Heroku apps
- **Deploy workflow**: Manual deployment triggers
- **Input parameters**: Customize workflow behavior

### Health Checks

- **Automatic verification**: Health endpoint testing
- **Retry logic**: Multiple attempts with delays
- **Rollback protection**: Automatic rollback on failure

### Post-Deployment Testing

- **API endpoint testing**: Verify all endpoints work
- **JWT authentication**: Test with real tokens
- **Response validation**: Check expected responses

## 🔄 Workflow Customization

### Modify Deployment Conditions

Edit `.github/workflows/deploy-heroku.yml`:

```yaml
on:
  push:
    branches: [ main, master, develop ]  # Add more branches
  pull_request:
    branches: [ main, master ]
  schedule:
    - cron: '0 0 * * *'  # Daily deployment
```

### Add More Tests

```yaml
- name: Additional tests
  run: |
    npm run lint
    npm run security-check
    npm run integration-tests
```

### Custom Health Checks

```yaml
healthcheck: "https://${{ secrets.HEROKU_APP_NAME }}.herokuapp.com/status"
checkstring: "running"
```

## 📚 Useful Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Heroku Deploy Action](https://github.com/akhileshns/heroku-deploy)
- [Heroku CLI Documentation](https://devcenter.heroku.com/articles/heroku-cli)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

## 🎯 Next Steps

1. **Configure GitHub secrets** with your Heroku credentials
2. **Run the setup workflow** to create and configure your Heroku app
3. **Push to main branch** to trigger automatic deployment
4. **Monitor deployment** in the Actions tab
5. **Test your deployed app** using the provided endpoints
6. **Customize workflows** as needed for your specific requirements

## 🆘 Support

For issues with:
- **GitHub Actions**: Check workflow logs and GitHub documentation
- **Heroku**: Use Heroku CLI and check Heroku logs
- **Application**: Verify environment variables and check application logs
- **Workflow Configuration**: Review the workflow files and customize as needed

Your Slack-KPI-Service is now ready for automated Heroku deployment with GitHub Actions! 🚀
