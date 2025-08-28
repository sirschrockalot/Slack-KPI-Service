# GitHub Actions + Heroku Quick Reference

## 🚀 Quick Setup

### 1. Configure GitHub Secrets

Go to **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|--------|-------|
| `HEROKU_API_KEY` | Your Heroku API key |
| `HEROKU_EMAIL` | Your Heroku email |
| `HEROKU_APP_NAME` | Your app name |

### 2. Run Setup Workflow

1. Go to **Actions** tab
2. Select **"Setup Heroku App"**
3. Click **"Run workflow"**
4. Enter app name, select **"setup"**
5. Click **"Run workflow"**

### 3. Configure Environment Variables

1. Go to **Actions** → **"Setup Heroku App"**
2. Click **"Run workflow"**
3. Enter app name, select **"configure"**
4. Click **"Run workflow"**

### 4. Deploy

**Automatic**: Push to `main` branch  
**Manual**: Go to **Actions** → **"Deploy to Heroku"** → **"Run workflow"**

## 📋 Required GitHub Secrets

```bash
HEROKU_API_KEY=12345678-1234-1234-1234-123456789abc
HEROKU_EMAIL=your-email@example.com
HEROKU_APP_NAME=your-app-name
```

## 🔧 Optional Secrets (for API testing)

```bash
AIRCALL_API_ID=your_aircall_api_id
AIRCALL_API_TOKEN=your_aircall_api_token
SLACK_API_TOKEN=xoxb-your-slack-token
SLACK_CHANNEL_ID=C1234567890
JWT_SECRET=your_jwt_secret
```

## 📊 Workflow Summary

### Test Job (Every push/PR)
- ✅ Node.js 18.x and 20.x testing
- ✅ Dependency installation
- ✅ Test execution
- ✅ Code quality checks

### Deploy Job (Main branch only)
- 🚀 Automatic Heroku deployment
- 🧪 Health check verification
- 🔄 Rollback on failure
- 📝 Post-deployment testing
- 📋 Deployment summary

## 🌐 App URLs

Once deployed:
- **App**: `https://your-app-name.herokuapp.com`
- **Health**: `https://your-app-name.herokuapp.com/health`
- **API Docs**: `https://your-app-name.herokuapp.com/api-docs`
- **Metrics**: `https://your-app-name.herokuapp.com/metrics`

## 🧪 Testing

### Health Check
```bash
curl https://your-app-name.herokuapp.com/health
```

### API Test
```bash
# Generate JWT token
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({user: 'test'}, 'your_jwt_secret'));"

# Test endpoint
curl -X POST https://your-app-name.herokuapp.com/report/afternoon \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 🔍 Monitoring

### GitHub Actions
- **Workflow runs**: Actions tab
- **Deployment logs**: Step-by-step logs
- **Deployment summary**: Summary with URLs

### Heroku
```bash
# App status
heroku ps --app your-app-name

# View logs
heroku logs --tail --app your-app-name

# Environment variables
heroku config --app your-app-name

# Restart app
heroku restart --app your-app-name
```

## 🆘 Troubleshooting

### Common Issues

1. **Build fails**
   - Check `package.json` dependencies
   - Verify `Procfile` and `app.json` exist

2. **Deployment fails**
   - Verify Heroku API key and email
   - Check app name exists
   

3. **Health check fails**
   - Check Heroku logs
   - Verify environment variables
   

### Debug Commands

```bash
# Check app status
heroku ps --app your-app-name

# View recent logs
heroku logs --app your-app-name

# Check environment
heroku config --app your-app-name

# Check add-ons
heroku addons --app your-app-name
```

## 📚 Full Documentation

- [GITHUB-ACTIONS-HEROKU-SETUP.md](./GITHUB-ACTIONS-HEROKU-SETUP.md) - Complete setup guide
- [HEROKU-DEPLOYMENT-GUIDE.md](./HEROKU-DEPLOYMENT-GUIDE.md) - Heroku deployment guide
- [HEROKU-QUICK-START.md](./HEROKU-QUICK-START.md) - Quick start guide

## 🎯 Workflow Files

- `.github/workflows/deploy-heroku.yml` - Main deployment workflow
- `.github/workflows/setup-heroku.yml` - App setup workflow

## 🚀 Next Steps

1. **Configure secrets** in GitHub
2. **Run setup workflow** to create Heroku app
3. **Push to main** for automatic deployment
4. **Monitor** in Actions tab
5. **Test** your deployed app

Your app will now automatically deploy to Heroku on every push to main! 🎉
