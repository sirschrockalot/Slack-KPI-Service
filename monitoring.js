const promClient = require('prom-client');
const prometheusMiddleware = require('express-prometheus-middleware');

// Create a Registry to register the metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

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

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(reportGenerationDuration);
register.registerMetric(reportGenerationTotal);
register.registerMetric(slackMessageSent);
register.registerMetric(aircallApiCalls);
register.registerMetric(schedulerRuns);

// Prometheus middleware configuration
const prometheusMiddlewareConfig = prometheusMiddleware({
  metricsPath: '/metrics',
  collectDefaultMetrics: false, // We're collecting them manually
  requestDurationBuckets: [0.1, 0.5, 1, 2, 5],
  requestLengthBuckets: [512, 1024, 5120, 10240, 51200],
  responseLengthBuckets: [512, 1024, 5120, 10240, 51200],
  customLabels: ['service'],
  transformLabels: (labels, req) => {
    labels.service = 'aircall-slack-agent';
    return labels;
  }
});

// Custom middleware for additional metrics
const customMetricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds
    
    // Record request duration
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
    
    // Increment request counter
    httpRequestsTotal
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .inc();
  });
  
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
    httpRequestDurationMicroseconds,
    httpRequestsTotal,
    reportGenerationDuration,
    reportGenerationTotal,
    slackMessageSent,
    aircallApiCalls,
    schedulerRuns
  }
}; 