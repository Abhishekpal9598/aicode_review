// Utility: Mask credentials and secrets in log messages
const redactSensitive = (content) => {
  if (typeof content !== 'string') {
    try {
      content = JSON.stringify(content);
    } catch {
      return String(content);
    }
  }

  // Redact MongoDB connection strings containing passwords
  // e.g. mongodb+srv://user:password@cluster... -> mongodb+srv://***@cluster...
  content = content.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1***$3');

  // Redact bearer tokens / JWT
  content = content.replace(/(bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]');

  // Redact API keys / secrets in key-value format
  content = content.replace(/(api[_-]?key|secret|password|token)["']?\s*[:=]\s*["']?([^"'\s]+)/gi, '$1: [REDACTED]');

  return content;
};

const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const safeMessage = redactSensitive(message);
  const safeArgs = args.length > 0 ? args.map(arg => redactSensitive(arg)).join(' ') : '';
  return `[${timestamp}] [${level}] ${safeMessage} ${safeArgs}`.trim();
};

export const logger = {
  info: (message, ...args) => {
    console.log(formatMessage('INFO', message, ...args));
  },
  warn: (message, ...args) => {
    console.warn(formatMessage('WARN', message, ...args));
  },
  error: (message, ...args) => {
    console.error(formatMessage('ERROR', message, ...args));
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('DEBUG', message, ...args));
    }
  }
};

export default logger;
