const promClient = require('prom-client');
const prometheusMiddleware = require('express-prometheus-middleware');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });



const reportGenerationDuration = new promClient.Histogram({
  name: 'report_generation_duration_seconds',
  help: 'Duration of report generation in seconds',
  labelNames: ['report_type'],
  buckets: [1, 5, 10, 30, 60]
});

const reportGenerationTotal = new promClient.Counter({
  name: 'report_generation_total',
  help: 'Total number of report generations',
  labelNames: ['report_type', 'status']
});

const slackMessageSent = new promClient.Counter({
  name: 'slack_messages_sent_total',
  help: 'Total number of Slack messages sent',
  labelNames: ['status']
});

const aircallApiCalls = new promClient.Counter({
  name: 'aircall_api_calls_total',
  help: 'Total number of Aircall API calls',
  labelNames: ['endpoint', 'status']
});

const schedulerRuns = new promClient.Counter({
  name: 'scheduler_runs_total',
  help: 'Total number of scheduler runs',
  labelNames: ['report_type', 'status']
});

// Register custom business metrics
register.registerMetric(reportGenerationDuration);
register.registerMetric(reportGenerationTotal);
register.registerMetric(slackMessageSent);
register.registerMetric(aircallApiCalls);
register.registerMetric(schedulerRuns);

// Prometheus middleware configuration
// NOTE: metricsPath set to '/internal-prometheus-metrics' to avoid conflicts
// We use a custom /metrics endpoint in ApiServer.js that is protected by JWT
const prometheusMiddlewareConfig = prometheusMiddleware({
  metricsPath: '/internal-prometheus-metrics', // Internal path, not exposed publicly
  collectDefaultMetrics: true, // Let the middleware handle default metrics
  requestDurationBuckets: [0.1, 0.5, 1, 2, 5],
  requestLengthBuckets: [512, 1024, 5120, 10240, 51200],
  responseLengthBuckets: [512, 1024, 5120, 10240, 51200],
  customLabels: ['service'],
  transformLabels: (labels, req) => {
    labels.service = 'aircall-slack-agent';
    return labels;
  }
});

// Custom middleware for additional business metrics
const customMetricsMiddleware = (req, res, next) => {
  // This middleware can be used for custom business logic metrics
  // The express-prometheus-middleware handles HTTP metrics automatically
  
  next();
};

// Helper functions for recording metrics
const recordReportGeneration = (reportType, duration, status = 'success') => {
  reportGenerationDuration.labels(reportType).observe(duration);
  reportGenerationTotal.labels(reportType, status).inc();
};

const recordSlackMessage = (status = 'success') => {
  slackMessageSent.labels(status).inc();
};

const recordAircallApiCall = (endpoint, status = 'success') => {
  aircallApiCalls.labels(endpoint, status).inc();
};

const recordSchedulerRun = (reportType, status = 'success') => {
  schedulerRuns.labels(reportType, status).inc();
};

module.exports = {
  register,
  prometheusMiddlewareConfig,
  customMetricsMiddleware,
  recordReportGeneration,
  recordSlackMessage,
  recordAircallApiCall,
  recordSchedulerRun,
  metrics: {
    reportGenerationDuration,
    reportGenerationTotal,
    slackMessageSent,
    aircallApiCalls,
    schedulerRuns
  }
}; 