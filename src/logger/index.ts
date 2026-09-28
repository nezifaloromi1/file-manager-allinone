export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => {
    if (__DEV__) {
      console.debug(message, metadata);
    }
  },
  error: (error: unknown, metadata?: Record<string, unknown>) => {
    console.error(error, metadata);
  },
};
