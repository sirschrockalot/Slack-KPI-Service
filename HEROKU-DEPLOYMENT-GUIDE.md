# Heroku Deployment Guide for Slack-KPI-Service

This guide will help you deploy the Slack-KPI-Service to Heroku.

## Prerequisites

1. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
2. **Heroku CLI**: Install from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Ensure your code is in a Git repository
4. **Environment Variables**: Gather your API keys and tokens

## Step 1: Install Heroku CLI

```bash
# macOS (using Homebrew)
brew tap heroku/brew && brew install heroku

# Windows
# Download installer from https://devcenter.heroku.com/articles/heroku-cli

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

## Step 2: Login to Heroku

```bash
heroku login
```

## Step 3: Create Heroku App

```bash
# Create a new Heroku app
heroku create your-slack-kpi-service

# Or if you already have an app
heroku git:remote -a your-existing-app-name
```



## Step 5: Set Environment Variables

```bash
# Set required environment variables
heroku config:set NODE_ENV=production
heroku config:set AIRCALL_API_ID=your_aircall_api_id
heroku config:set AIRCALL_API_TOKEN=your_aircall_api_token
heroku config:set SLACK_API_TOKEN=xoxb-your-slack-bot-token
heroku config:set SLACK_CHANNEL_ID=C1234567890
heroku config:set JWT_SECRET=your_jwt_secret_here

# Set optional environment variables
heroku config:set EXCLUDED_USERS="Joel Schrock,Test User"
heroku config:set AFTERNOON_REPORT_TIME=19:34
heroku config:set NIGHT_REPORT_TIME=22:00
heroku config:set TZ=America/Chicago
heroku config:set ENABLE_SWAGGER=true
heroku config:set ENABLE_METRICS=true
heroku config:set LOG_LEVEL=info
```

## Step 6: Deploy to Heroku

```bash
# Add all files to git
git add .

# Commit changes
git commit -m "Prepare for Heroku deployment"

# Deploy to Heroku
git push heroku main
```

## Step 7: Verify Deployment

```bash
# Check app status
heroku ps

# View logs
heroku logs --tail

# Open the app
heroku open

# Test health endpoint
curl https://your-app-name.herokuapp.com/health
```

## Step 8: Test API Endpoints

```bash
# Generate JWT token (replace with your JWT_SECRET)
node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({user: 'test'}, 'your_jwt_secret_here'));"

# Test afternoon report endpoint
curl -X POST https://your-app-name.herokuapp.com/report/afternoon \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Environment Variables Reference

### Required Variables
- `AIRCALL_API_ID`: Your Aircall API ID
- `AIRCALL_API_TOKEN`: Your Aircall API Token
- `SLACK_API_TOKEN`: Your Slack Bot Token (starts with `xoxb-`)
- `SLACK_CHANNEL_ID`: The Slack channel ID where reports will be sent
- `JWT_SECRET`: Secret key for JWT token generation

### Optional Variables
- `EXCLUDED_USERS`: Comma-separated list of users to exclude from reports
- `AFTERNOON_REPORT_TIME`: Time for afternoon reports (HH:MM format)
- `NIGHT_REPORT_TIME`: Time for night reports (HH:MM format)
- `TZ`: Timezone for the application
- `ENABLE_SWAGGER`: Enable/disable Swagger API documentation
- `ENABLE_METRICS`: Enable/disable Prometheus metrics
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

## MongoDB Configuration

The app will automatically use the MongoDB connection string provided by Heroku add-ons. If you're using MongoDB Atlas:

```bash
# Set MongoDB URI manually
heroku config:set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
```

## Monitoring and Logs

```bash
# View real-time logs
heroku logs --tail

# View recent logs
heroku logs

# Check app metrics
heroku ps

# Monitor dyno usage
heroku ps:scale web=1
```

## Scaling (Optional)

```bash
# Scale to multiple dynos for better performance
heroku ps:scale web=2

# Scale back down
heroku ps:scale web=1
```

## Troubleshooting

### Common Issues

1. **Build Failures**: Check that all dependencies are in `package.json`
2. **Port Issues**: Heroku sets `PORT` environment variable automatically

4. **Environment Variables**: Verify all required variables are set

### Debug Commands

```bash
# Check environment variables
heroku config

# Run app locally with Heroku config
heroku local web

# Check build logs
heroku builds

# Restart the app
heroku restart
```

## API Endpoints

Once deployed, your app will be available at:
- **Health Check**: `https://your-app-name.herokuapp.com/health`
- **API Documentation**: `https://your-app-name.herokuapp.com/api-docs`
- **Metrics**: `https://your-app-name.herokuapp.com/metrics`
- **Afternoon Report**: `POST https://your-app-name.herokuapp.com/report/afternoon`
- **Night Report**: `POST https://your-app-name.herokuapp.com/report/night`
- **Custom Report**: `POST https://your-app-name.herokuapp.com/report/custom`

## Security Notes

1. **JWT Tokens**: Generate secure JWT secrets for production
2. **API Keys**: Never commit API keys to version control
3. **HTTPS**: Heroku provides HTTPS by default
4. **Rate Limiting**: The app includes rate limiting for API endpoints

## Cost Considerations

- **Free Tier**: No longer available on Heroku
- **Basic Dyno**: ~$7/month
- **MongoDB Add-on**: Free tier available for development
- **Custom Domain**: Additional cost if needed

## Support

For issues with:
- **Heroku Platform**: [help.heroku.com](https://help.heroku.com)
- **MongoDB**: [docs.mongodb.com](https://docs.mongodb.com)
- **Application**: Check the logs and this repository
