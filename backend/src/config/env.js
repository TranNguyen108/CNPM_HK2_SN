require('dotenv').config();

const getEnv = (name, options = {}) => {
  const value = process.env[name];
  const trimmed = typeof value === 'string' ? value.trim() : value;

  if (trimmed) return trimmed;
  if (options.defaultValue !== undefined) return options.defaultValue;
  if (options.required) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return null;
};

const isProduction = () => getEnv('NODE_ENV', { defaultValue: 'development' }) === 'production';

const parseAllowedOrigins = () => {
  const rawOrigins = getEnv('CORS_ORIGIN') || getEnv('FRONTEND_URL') || '';

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const validateRuntimeEnv = () => {
  getEnv('JWT_SECRET', { required: true });
  getEnv('JWT_REFRESH_SECRET', { required: true });
  getEnv('JWT_EXPIRES_IN', { required: true });
  getEnv('JWT_REFRESH_EXPIRES_IN', { required: true });
  getEnv('AES_KEY', { required: true });

  if (!getEnv('DATABASE_URL')) {
    getEnv('DB_HOST', { required: true });
    getEnv('DB_PORT', { required: true });
    getEnv('DB_NAME', { required: true });
    getEnv('DB_USER', { required: true });
    getEnv('DB_PASSWORD', { required: true });
  }

  if (isProduction() && parseAllowedOrigins().length === 0) {
    throw new Error('Missing required environment variable: CORS_ORIGIN (or FRONTEND_URL) in production');
  }
};

module.exports = {
  getEnv,
  isProduction,
  parseAllowedOrigins,
  validateRuntimeEnv
};
