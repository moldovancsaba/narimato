type LogLevel = 'info' | 'warn' | 'error';

export function createLogger(namespace: string) {
  return new Logger(namespace);
}

interface LogData {
  [key: string]: any;
}

class Logger {
  constructor(private namespace?: string) {}

  private log(level: LogLevel, message: string, data: LogData = {}) {
    const timestamp = new Date().toISOString();
const logData = {
      timestamp,
      level,
      namespace: this.namespace,
      message,
      ...data
    };

    switch (level) {
      case 'info':
        console.log(JSON.stringify(logData));
        break;
      case 'warn':
        console.warn(JSON.stringify(logData));
        break;
      case 'error':
        console.error(JSON.stringify(logData));
        break;
    }
  }

  info(message: string, data?: LogData) {
    this.log('info', message, data);
  }

  warn(message: string, data?: LogData) {
    this.log('warn', message, data);
  }

  error(message: string, data?: LogData) {
    this.log('error', message, data);
  }
}

export const logger = new Logger();
