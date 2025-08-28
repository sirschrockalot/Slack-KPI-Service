# Heroku Quick Start Guide

## 🚀 Quick Deployment

1. **Install Heroku CLI** (if not already installed):
   ```bash
   brew tap heroku/brew && brew install heroku  # macOS
   ```

2. **Login to Heroku**:
   ```bash
   heroku login
   ```

3. **Run the deployment script**:
   ```bash
   ./scripts/deploy-heroku.sh your-app-name
   ```

## 🔧 Manual Setup

If you prefer to set up manually:

```bash
# Create app
heroku create your-app-name



# Set environment variables
heroku config:set AIRCALL_API_ID=your_api_id
heroku config:set AIRCALL_API_TOKEN=your_api_token
heroku config:set SLACK_API_TOKEN=xoxb-your-slack-token
heroku config:set SLACK_CHANNEL_ID=C1234567890
heroku config:set JWT_SECRET=your_jwt_secret

# Deploy
git push heroku main
```

## 🔑 Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AIRCALL_API_ID` | Your Aircall API ID | `your-aircall-api-id` |
| `AIRCALL_API_TOKEN` | Your Aircall API Token | `your-aircall-api-token` |
| `SLACK_API_TOKEN` | Slack Bot Token | `xoxb-your-slack-bot-token` |
| `SLACK_CHANNEL_ID` | Slack Channel ID | `your-slack-channel-id` |
| `JWT_SECRET` | JWT Secret for API auth | `your-secret-key-here` |

## 🌐 App URLs

Once deployed, your app will be available at:
- **Main App**: `https://your-app-name.herokuapp.com`
- **Health Check**: `https://your-app-name.herokuapp.com/health`
- **API Docs**: `https://your-app-name.herokuapp.com/api-docs`

## 📋 Useful Commands

```bash
# View logs
heroku logs --tail

# Open app
heroku open

# Check status
heroku ps

# Restart app
heroku restart

# Scale dynos
heroku ps:scale web=2
```

## 🧪 Testing API

Generate JWT token:
```bash
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({user: 'test'}, 'your_jwt_secret'));"
```

Test endpoint:
```bash
curl -X POST https://your-app-name.herokuapp.com/report/afternoon \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 💰 Cost

- **Basic Dyno**: ~$7/month

- **Custom Domain**: Additional cost if needed

## 🆘 Troubleshooting

- **Build fails**: Check `package.json` dependencies
- **App won't start**: Check logs with `heroku logs --tail`
- **Environment variables**: Verify with `heroku config`


## 📚 Full Documentation

See [HEROKU-DEPLOYMENT-GUIDE.md](./HEROKU-DEPLOYMENT-GUIDE.md) for detailed instructions.
