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
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function line(level, message, color) {
  return `${COLORS.gray}[${timestamp()}]${COLORS.reset} ${color}[${level}]${COLORS.reset} ${message}`;
}

export const logger = {
  info(message) {
    console.log(line('INFO', message, COLORS.blue));
  },
  success(message) {
    console.log(line('OK', message, COLORS.green));
  },
  warn(message) {
    console.warn(line('WARN', message, COLORS.yellow));
  },
  error(message) {
    console.error(line('ERROR', message, COLORS.red));
  },
  debug(message) {
    if (process.env.DEBUG === 'true') {
      console.log(line('DEBUG', message, COLORS.magenta));
    }
  },
  sku(sku, message) {
    console.log(line(`SKU ${sku}`, message, COLORS.cyan));
  },
  separator() {
    console.log(`${COLORS.gray}${'-'.repeat(60)}${COLORS.reset}`);
  },
  header(title) {
    this.separator();
    console.log(`${COLORS.cyan}${title}${COLORS.reset}`);
    this.separator();
  },
};

export default logger;
