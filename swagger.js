const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Aircall Slack Agent API',
      version: '1.0.0',
      description: 'API for monitoring Aircall activity and generating Slack reports',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              example: 'Error message'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully'
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'healthy'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00.000Z'
            },
            service: {
              type: 'string',
              example: 'aircall-slack-agent'
            }
          }
        },
        StatusResponse: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              example: 'aircall-slack-agent'
            },
            mode: {
              type: 'string',
              example: 'on-demand'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T12:00:00.000Z'
            },
            excludedUsers: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['Joel Schrock']
            },
            endpoints: {
              type: 'object',
              properties: {
                health: {
                  type: 'string',
                  example: 'GET /health'
                },
                status: {
                  type: 'string',
                  example: 'GET /status'
                },
                afternoonReport: {
                  type: 'string',
                  example: 'POST /report/afternoon'
                },
                nightReport: {
                  type: 'string',
                  example: 'POST /report/night'
                },
                customReport: {
                  type: 'string',
                  example: 'POST /report/custom'
                }
              }
            }
          }
        },
        CustomReportRequest: {
          type: 'object',
          required: ['startTime', 'endTime'],
          properties: {
            startTime: {
              type: 'string',
              format: 'date-time',
              description: 'Start time in ISO8601 format',
              example: '2024-01-01T09:00:00.000Z'
            },
            endTime: {
              type: 'string',
              format: 'date-time',
              description: 'End time in ISO8601 format',
              example: '2024-01-01T17:00:00.000Z'
            },
            reportName: {
              type: 'string',
              description: 'Optional name for the report',
              example: 'Custom Report'
            }
          }
        },
        SchedulerStatus: {
          type: 'object',
          properties: {
            isRunning: {
              type: 'boolean',
              example: true
            },
            nextAfternoonRun: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T14:00:00.000Z'
            },
            nextNightRun: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T22:00:00.000Z'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './ApiServer.js'] // Path to the API docs
};

const specs = swaggerJsdoc(options);

module.exports = specs; 