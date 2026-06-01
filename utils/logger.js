/**
 * Logger utilitário com níveis e timestamps
 */

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function formatMessage(level, message, color) {
  const ts = `${COLORS.gray}[${timestamp()}]${COLORS.reset}`;
  const lvl = `${color}[${level}]${COLORS.reset}`;
  return `${ts} ${lvl} ${message}`;
}

export const logger = {
  info(message) {
    console.log(formatMessage('INFO', message, COLORS.blue));
  },

  success(message) {
    console.log(formatMessage('OK', message, COLORS.green));
  },

  warn(message) {
    console.warn(formatMessage('WARN', message, COLORS.yellow));
  },

  error(message) {
    console.error(formatMessage('ERROR', message, COLORS.red));
  },

  debug(message) {
    if (process.env.DEBUG === 'true') {
      console.log(formatMessage('DEBUG', message, COLORS.magenta));
    }
  },

  sku(sku, message) {
    console.log(formatMessage(`SKU ${sku}`, message, COLORS.cyan));
  },

  separator() {
    console.log(`${COLORS.gray}${'─'.repeat(60)}${COLORS.reset}`);
  },

  header(title) {
    this.separator();
    console.log(`${COLORS.cyan}${title}${COLORS.reset}`);
    this.separator();
  },
};

export default logger;
