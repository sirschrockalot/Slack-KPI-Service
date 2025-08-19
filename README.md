# Aircall Slack Agent

A Node.js service that fetches call activity data from Aircall and sends automated reports to Slack. The service is deployed on Google Kubernetes Service (GKS) with automated CI/CD via GitHub Actions.

## 🚀 Deployment

This service is deployed to **Google Kubernetes Service (GKS)** using our automated CI/CD pipeline:

**Deployment Status**: ✅ **Production Ready on GKS**

The service is automatically deployed via GitHub Actions when you push to the main branch:
- **Build**: Docker image built and pushed to Artifact Registry
- **Deploy**: Automatic deployment to GKS cluster with manual approval
- **Scale**: Auto-scaling based on CPU/memory usage (2-10 replicas)
- **Monitor**: Built-in health checks and Prometheus metrics

### Access URLs
- **Health Check**: http://34.41.164.37/health
- **Status**: http://34.41.164.37/status
- **Metrics**: http://34.41.164.37/metrics
- **API Docs**: http://34.41.164.37/api-docs

For detailed deployment information, see:
- [GITHUB-ACTIONS-SETUP.md](GITHUB-ACTIONS-SETUP.md) - GitHub Actions configuration
- [GKS-DEPLOYMENT-GUIDE-IMPROVED.md](GKS-DEPLOYMENT-GUIDE-IMPROVED.md) - GKS deployment guide
- [WORKLOAD-IDENTITY-SUMMARY.md](WORKLOAD-IDENTITY-SUMMARY.md) - Security setup

## Features

- 🔄 **On-demand reporting** - Generate reports via API endpoints
- 📊 **Multiple report types** - Afternoon, night, and custom time range reports
- 🚫 **User exclusions** - Filter out specific users from reports
- 🔍 **Health monitoring** - Built-in health checks and connection validation
- 📝 **Comprehensive logging** - Winston-based logging with file and console output
- 🌐 **RESTful API** - Clean API interface for external integrations
- 🛡️ **Security** - Rate limiting, input validation, security headers, and JWT authentication
- 📚 **API Documentation** - Interactive Swagger/OpenAPI documentation
- 📊 **Monitoring & Observability** - Prometheus metrics, structured logging, and performance monitoring
- ⏰ **Scheduled Reports** - Automated report generation with configurable schedules

## Security Features

- **Rate Limiting:** All endpoints are protected by rate limiting (100 requests per 15 minutes per IP).
- **Input Validation & Sanitization:** All input to endpoints is validated and sanitized using `express-validator`.
- **Security Headers:** HTTP security headers are set using `helmet`.
- **JWT Authentication:** All endpoints (except `/health` and `/status`) require a valid JWT in the `Authorization` header.

## Prerequisites

- Node.js (v14 or higher)
- NPM or Yarn
- Aircall API credentials
- Slack Bot Token and Channel ID

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/aircall-slack-agent.git
   cd aircall-slack-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create logs directory**
   ```bash
   mkdir logs
   ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/aircall-slack-agent?retryWrites=true&w=majority

# Aircall API Configuration
AIRCALL_API_ID=your_aircall_api_id
AIRCALL_API_TOKEN=your_aircall_api_token

# Slack Configuration
SLACK_API_TOKEN=xoxb-your-slack-bot-token
SLACK_CHANNEL_ID=C1234567890

# Optional Configuration
PORT=3000
EXCLUDED_USERS=Joel Schrock,Another User

# JWT Secret (required for authentication)
JWT_SECRET=your_strong_jwt_secret

# GitHub Actions (alternative variable names)
INPUT_AIRCALL_API_ID=your_aircall_api_id
INPUT_AIRCALL_API_TOKEN=your_aircall_api_token
INPUT_SLACK_API_TOKEN=xoxb-your-slack-bot-token
INPUT_SLACK_CHANNEL_ID=C1234567890
INPUT_EXCLUDED_USERS=Joel Schrock,Another User
```

### Required Credentials

#### Aircall API
1. Log into your Aircall dashboard
2. Go to **Integrations** > **API Keys**
3. Generate an API ID and Token
4. Add these to your environment variables

#### Slack Bot Token
1. Visit [Slack API](https://api.slack.com/apps)
2. Create a new app or use an existing one
3. Go to **OAuth & Permissions**
4. Add the following scopes:
   - `chat:write`
   - `channels:read`
   - `groups:read`
5. Install the app to your workspace
6. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

#### Slack Channel ID
1. Open Slack in your browser
2. Navigate to the target channel
3. Copy the channel ID from the URL (e.g., `C1234567890`)

#### MongoDB Atlas Setup
1. Create a free MongoDB Atlas account at [mongodb.com](https://www.mongodb.com/atlas)
2. Create a new cluster (M0 Free tier is sufficient for development)
3. Create a database user with read/write permissions
4. Get your connection string from the "Connect" button
5. Replace `username`, `password`, and `cluster` in the connection string
6. Add the connection string to your `.env` file as `MONGODB_URI`

Example connection string:
```
mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/aircall-slack-agent?retryWrites=true&w=majority
```

## Usage

### Running the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

#### Using Node directly
```bash
node index.js
```

### API Documentation

The service includes interactive API documentation powered by Swagger/OpenAPI 3.0.

#### Access API Documentation
Once the service is running, visit:
```
http://localhost:3000/api-docs
```

The documentation includes:
- Interactive testing of all endpoints
- Request/response schemas
- Authentication requirements
- Example requests and responses

### API Endpoints

The service exposes the following endpoints:

#### Health Check
```bash
GET /health
```
Returns service health status. (No authentication required)

#### Service Status
```bash
GET /status
```
Returns detailed service information and available endpoints. (No authentication required)

#### Metrics
```bash
GET /metrics
```
Returns Prometheus metrics for monitoring. (No authentication required)

#### Test Connections
```bash
GET /test-connections
```
**Requires JWT authentication**

#### Generate Reports

**Afternoon Report**
```bash
POST /report/afternoon
```
**Requires JWT authentication**

**Night Report**
```bash
POST /report/night
```
**Requires JWT authentication**

**Custom Time Range Report**
```bash
POST /report/custom
Content-Type: application/json
Authorization: Bearer <your_jwt_token>

{
  "startTime": "2025-07-03T11:00:00.000Z",
  "endTime": "2025-07-04T01:00:00.000Z",
  "reportName": "Custom Report Name"
}
```

### Example API Calls

#### Using curl
```bash
# Health check (no auth)
curl http://localhost:3000/health

# Generate afternoon report (with JWT)
curl -X POST http://localhost:3000/report/afternoon \
  -H "Authorization: Bearer <your_jwt_token>"

# Generate custom report (with JWT)
curl -X POST http://localhost:3000/report/custom \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "startTime": "2025-07-03T11:00:00.000Z",
    "endTime": "2025-07-04T01:00:00.000Z",
    "reportName": "July 3rd Daily Report"
  }'
```

#### Using JavaScript
```javascript
// Generate afternoon report (with JWT)
fetch('http://localhost:3000/report/afternoon', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <your_jwt_token>'
  }
})
.then(response => response.json())
.then(data => console.log(data));

// Generate custom report (with JWT)
fetch('http://localhost:3000/report/custom', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your_jwt_token>'
  },
  body: JSON.stringify({
    startTime: '2025-07-03T11:00:00.000Z',
    endTime: '2025-07-04T01:00:00.000Z',
    reportName: 'Custom Report'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Project Structure

```
aircall-slack-agent/
├── index.js                 # Main application entry point
├── ApiServer.js             # Express server and API routes
├── SlackService.js          # Slack API integration
├── AircallService.js        # Aircall API integration
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables (create this)
├── .env.example             # Environment variables template
├── logs/                    # Log files directory
│   ├── error.log           # Error logs
│   └── combined.log        # All logs
├── routes/                  # API route handlers
│   ├── health.js           # Health check endpoints
│   ├── report.js           # Report generation endpoints
│   ├── scheduler.js        # Scheduler management endpoints
│   └── testConnections.js  # Connection testing endpoints
├── services/               # Business logic services
│   └── reportScheduler.js  # Automated report scheduling
├── models/                 # Database models
│   ├── Report.js           # Report model
│   └── SyncStatus.js       # Sync status tracking
├── monitoring/             # Monitoring configuration
│   ├── prometheus.yml      # Prometheus config
│   ├── alert_rules.yml     # Alerting rules
│   └── alertmanager.yml    # Alertmanager config
└── README.md               # This file
```

**Note:** This service uses MongoDB Atlas for database storage. No local MongoDB installation is required.

## Monitoring & Observability

The service includes comprehensive monitoring and observability features.

### Metrics & Monitoring

#### Prometheus Metrics
The service exposes Prometheus metrics at `/metrics` for monitoring:

- **System Metrics**: CPU, memory, event loop lag
- **HTTP Metrics**: Request duration, throughput, error rates
- **Business Metrics**: Report generation success, Slack message delivery, Aircall API calls
- **Custom Metrics**: Scheduler execution, report types, performance indicators

#### Monitoring Stack Setup
Use Docker Compose profiles to start the monitoring stack:

```bash
# Start just the main application (requires MongoDB Atlas connection)
docker-compose up -d

# Start application with monitoring stack
docker-compose --profile monitoring up -d

# Start only monitoring stack (if app is running separately)
docker-compose --profile monitoring up -d
```

This includes:
- **Main Application**: Aircall Slack Agent (connects to MongoDB Atlas)
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Dashboards and visualization
- **Alertmanager**: Alert routing and notification
- **Node Exporter**: System metrics
- **cAdvisor**: Container metrics

**Note:** The application requires a MongoDB Atlas connection string in the `MONGODB_URI` environment variable.

Access the monitoring tools:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)
- Alertmanager: http://localhost:9093

### Logging

The application uses Winston for structured logging with the following outputs:

- **Console**: Colored, simple format for development
- **File**: JSON format in `logs/combined.log`
- **Error File**: Error-level logs in `logs/error.log`

Log levels: `error`, `warn`, `info`, `debug`

### Health Checks

The service provides multiple health check endpoints:

- `/health`: Basic service health
- `/status`: Detailed service status and configuration
- `/metrics`: Prometheus metrics endpoint

### Performance Monitoring

Key metrics to monitor:
- **Response Time**: Target < 2 seconds (95th percentile)
- **Error Rate**: Target < 1%
- **Report Generation Time**: Target < 30 seconds
- **Memory Usage**: Monitor for leaks
- **CPU Usage**: Monitor for bottlenecks

For detailed monitoring setup and configuration, see [MONITORING-GUIDE.md](MONITORING-GUIDE.md).

## GitHub Actions Integration

The service is designed to work with GitHub Actions. Use the `INPUT_*` environment variable names when running in GitHub Actions:

```yaml
- name: Run Aircall Slack Agent
  env:
    INPUT_AIRCALL_API_ID: ${{ secrets.AIRCALL_API_ID }}
    INPUT_AIRCALL_API_TOKEN: ${{ secrets.AIRCALL_API_TOKEN }}
    INPUT_SLACK_API_TOKEN: ${{ secrets.SLACK_API_TOKEN }}
    INPUT_SLACK_CHANNEL_ID: ${{ secrets.SLACK_CHANNEL_ID }}
    INPUT_EXCLUDED_USERS: ${{ secrets.EXCLUDED_USERS }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
  run: |
    npm install
    npm start
```

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure all required environment variables are set
   - Check variable names match exactly (case-sensitive)

2. **"Slack connection validation failed"**
   - Verify your Slack bot token is correct
   - Ensure the bot has proper permissions
   - Check that the channel ID is correct

3. **"Aircall connection validation failed"**
   - Verify your Aircall API credentials
   - Check that your Aircall account has API access enabled

4. **"ENOENT: no such file or directory, open 'logs/error.log'"**
   - Create the logs directory: `mkdir logs`

### Debugging

Enable debug logging by setting the log level to `debug`:

```javascript
// In ApiServer.js, change the logger level
this.logger = winston.createLogger({
  level: 'debug',  // Change from 'info' to 'debug'
  // ... rest of config
});
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
1. Check the [Issues](https://github.com/yourusername/aircall-slack-agent/issues) page
2. Create a new issue with detailed information
3. Include relevant logs and error messages
