const { Sequelize } = require('sequelize');
const { getEnv, isProduction } = require('./env');

const databaseUrl = getEnv('DATABASE_URL');
const dialect = getEnv('DB_DIALECT', { defaultValue: 'mysql' });
const useSsl = getEnv('DB_SSL', { defaultValue: isProduction() ? 'true' : 'false' }) === 'true';

const commonOptions = {
  dialect,
  logging: false
};

if (useSsl) {
  commonOptions.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  };
}

const sequelize = databaseUrl
  ? new Sequelize(databaseUrl, commonOptions)
  : new Sequelize(
    getEnv('DB_NAME', { required: true }),
    getEnv('DB_USER', { required: true }),
    getEnv('DB_PASSWORD', { required: true }),
    {
      ...commonOptions,
      host: getEnv('DB_HOST', { required: true }),
      port: Number(getEnv('DB_PORT', { defaultValue: '3306' }))
    }
  );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
  } catch (err) {
    console.error('Database connection failed.');
    console.error('DB target:', {
      databaseUrl: databaseUrl ? '[provided]' : '[not provided]',
      host: databaseUrl ? undefined : getEnv('DB_HOST'),
      port: databaseUrl ? undefined : Number(getEnv('DB_PORT', { defaultValue: '3306' })),
      database: databaseUrl ? undefined : getEnv('DB_NAME'),
      user: databaseUrl ? undefined : getEnv('DB_USER'),
      dialect,
      ssl: useSsl
    });
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      parentCode: err.parent?.code,
      parentErrno: err.parent?.errno,
      parentSyscall: err.parent?.syscall,
      parentAddress: err.parent?.address,
      parentPort: err.parent?.port
    });
    throw err;
  }
};

module.exports = { sequelize, connectDB };
