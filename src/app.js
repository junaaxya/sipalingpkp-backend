const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const path = require('path');
const { sequelize, testConnection } = require('./config/database');
const {
    globalErrorHandler,
    notFoundHandler,
} = require('./errors/errorMiddleware');

const app = express();
app.use(compression());

// Cloud Run sets PORT environment variable, default to 8080 for Cloud Run compatibility
const PORT = process.env.PORT || 8080;

// Middleware setup

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
    cors({
        origin: true, // Artinya: "Terima origin dari mana saja (termasuk port 3000)"
        credentials: true, // Izinkan bawa cookie/token
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'Idempotency-Key',
            'X-Idempotency-Key',
            'ngrok-skip-browser-warning',
        ],
    })
);

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (uploaded photos)
const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
const setFileHeaders = (req, res, next) => {
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return next();
};
if (storageDriver === 's3') {
    const { getFileStream } = require('./utils/fileUpload');
    app.use('/api/files', setFileHeaders, async (req, res, next) => {
        try {
            const fileKey = req.path.replace(/^\/+/, '');
            if (!fileKey) {
                return res.status(404).json({ message: 'File not found' });
            }
            const fileData = await getFileStream(fileKey);
            if (!fileData || !fileData.stream) {
                return res.status(404).json({ message: 'File not found' });
            }
            if (fileData.contentType)
                res.set('Content-Type', fileData.contentType);
            if (fileData.contentLength)
                res.set('Content-Length', fileData.contentLength);
            res.set(
                'Cache-Control',
                fileData.cacheControl || 'public, max-age=86400'
            );
            return fileData.stream.pipe(res);
        } catch (error) {
            if (
                error?.name === 'NoSuchKey' ||
                error?.$metadata?.httpStatusCode === 404
            ) {
                return res.status(404).json({ message: 'File not found' });
            }
            return next(error);
        }
    });
} else {
    app.use(
        '/api/files',
        setFileHeaders,
        express.static(path.join(process.cwd(), 'uploads'), {
            maxAge: '1d', // Cache for 1 day
            etag: true,
            lastModified: true,
        })
    );
}

// Error context middleware

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// API routes
app.get('/api', (req, res) => {
    res.json({
        message: 'Welcome to Sipaling PKP API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            api: '/api',
            auth: '/api/auth',
            users: '/api/user',
            housing: '/api/housing',
            facility: '/api/facility',
            housingDevelopments: '/api/housing-developments',
            locations: '/api/locations',
        },
    });
});

// Import and use routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const housingRoutes = require('./routes/housingRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const housingDevelopmentRoutes = require('./routes/housingDevelopmentRoutes');
const locationRoutes = require('./routes/locationRoutes');
const exportRoutes = require('./routes/exportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);

// Protected routes
app.use('/api/user', userRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/housing', housingRoutes);
app.use('/api/facility', facilityRoutes);
app.use('/api/housing-developments', housingDevelopmentRoutes);
app.use('/api/housing-development', housingDevelopmentRoutes);
app.use('/api/export', exportRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
    try {
        // Listen on port FIRST (required for Cloud Run)
        // Use '0.0.0.0' to listen on all interfaces (required for Cloud Run)
        app.listen(PORT, '0.0.0.0', async () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(
                `📊 Environment: ${process.env.NODE_ENV || 'development'}`
            );
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            if (process.env.NODE_ENV === 'production') {
                try {
                    // 'alter: true' akan menyesuaikan tabel tanpa menghapus data yang ada
                    await sequelize.sync({ alter: true });
                    console.log('✅ Database synchronized successfully.');
                } catch (dbError) {
                    console.error('❌ Database sync failed:', dbError.message);
                }
            }

            await testConnection();

            // Test database connection AFTER server starts (non-blocking)
            // This allows Cloud Run to connect even if DB is not ready
            testConnection().catch((error) => {
                console.error('⚠️  Database connection failed:', error.message);
                console.error(
                    '⚠️  Server will continue running. Database will be connected on first request.'
                );
                // Don't exit - let the server continue running
                // Sequelize will retry connection automatically on first query
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;
