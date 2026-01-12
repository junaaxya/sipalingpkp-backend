const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sipaling_pkp',
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    // dialectOptions: (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') ? {
    //   ssl: {
    //     require: true,
    //     rejectUnauthorized: false,
    //   },
    // } : {}
    dialectOptions:
        process.env.DB_SSL === 'true'
            ? {
                  ssl: {
                      require: true,
                      rejectUnauthorized: false, // Penting untuk sertifikat self-signed/cloud
                  },
              }
            : {},
    logging:
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'sandbox'
            ? console.log
            : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    define: {
        timestamps: true,
        underscored: true,
        freezeTableName: true,
    },
});

// Test the connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log(
            '✅ Database connection has been established successfully.'
        );
        return true;
    } catch (error) {
        console.error('❌ Unable to connect to the database:', error.message);
        return false;
    }
};

module.exports = { sequelize, testConnection };
