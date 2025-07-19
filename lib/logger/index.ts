import pino from 'pino';

export function createLogger(component: string) {
  return pino({
    name: component,
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: {
      level: (label) => ({ level: label })
    },
    hooks: {
      logMethod(inputArgs: any, method: any) {
        const [msg, ctx] = inputArgs;
        return method.call(this, msg, {
          ...ctx,
          component,
          version: process.env.npm_package_version
        });
      }
    }
  });
}
