import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const Logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  redact: {
    paths: ['password', 'token', 'apiKey', 'secret', 'creditCard'],
    remove: true,
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined,
});
