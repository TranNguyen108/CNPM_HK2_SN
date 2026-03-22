const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    dialect: 'mysql',
    logging: false
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
  } catch (err) {
    console.error('Database connection failed.');
    console.error('DB target:', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER
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
