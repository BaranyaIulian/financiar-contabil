import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', 'token', '*.token'],
    remove: true,
  },
});
