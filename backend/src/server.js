import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

// Import services and middleware
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { metricsMiddleware } from './middleware/metrics.js';

// Import route handlers
import dataDAORoutes from './routes/datadao.js';
import analyticsRoutes from './routes/analytics.js';
import feedsRoutes from './routes/feeds.js';
import airdropRoutes from './routes/airdrop.js';
import auditRoutes from './routes/audit.js';
import relayerRoutes from './routes/relayer.js';
import healthRoutes from './routes/health.js';

// Import background services
import { DataDAOService } from './services/DataDAOService.js';
import { AnalyticsService } from './services/AnalyticsService.js';
import { FeedsService } from './services/FeedsService.js';
import { AuditService } from './services/AuditService.js';
import { RelayerService } from './services/RelayerService.js';

// Import database and cache
import { initializeDatabase } from './database/index.js';
import { initializeRedis } from './cache/redis.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Global middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));

app.use(compression());
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);
app.use(metricsMiddleware);

// Health check endpoint (no auth required)
app.use('/api/health', healthRoutes);

// API routes with authentication
app.use('/api/datadao', authMiddleware, dataDAORoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/feeds', authMiddleware, feedsRoutes);
app.use('/api/airdrop', authMiddleware, airdropRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);
app.use('/api/relayer', authMiddleware, relayerRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    
    socket.on('subscribe', (channel) => {
        socket.join(channel);
        logger.info(`Client ${socket.id} subscribed to ${channel}`);
    });
    
    socket.on('unsubscribe', (channel) => {
        socket.leave(channel);
        logger.info(`Client ${socket.id} unsubscribed from ${channel}`);
    });
    
    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global services instances
let services = {};

// Initialize services
async function initializeServices() {
    try {
        logger.info('Initializing backend services...');
        
        // Initialize database and cache
        await initializeDatabase();
        await initializeRedis();
        
        // Initialize blockchain services
        services.dataDAO = new DataDAOService();
        services.analytics = new AnalyticsService();
        services.feeds = new FeedsService();
        services.audit = new AuditService();
        services.relayer = new RelayerService();
        
        // Initialize all services
        await Promise.all([
            services.dataDAO.initialize(),
            services.analytics.initialize(),
            services.feeds.initialize(),
            services.audit.initialize(),
            services.relayer.initialize()
        ]);
        
        // Make services available globally
        app.locals.services = services;
        
        // Start background workers
        startBackgroundWorkers();
        
        logger.info('All services initialized successfully');
        
    } catch (error) {
        logger.error('Failed to initialize services:', error);
        process.exit(1);
    }
}

// Background workers
function startBackgroundWorkers() {
    logger.info('Starting background workers...');
    
    // Data feeds updater (every 30 seconds)
    setInterval(async () => {
        try {
            await services.feeds.updateAllFeeds();
        } catch (error) {
            logger.error('Error updating feeds:', error);
        }
    }, 30000);
    
    // Analytics processor (every 5 minutes)
    setInterval(async () => {
        try {
            await services.analytics.processAnalytics();
        } catch (error) {
            logger.error('Error processing analytics:', error);
        }
    }, 300000);
    
    // Audit log processor (every minute)
    setInterval(async () => {
        try {
            await services.audit.processAuditLogs();
        } catch (error) {
            logger.error('Error processing audit logs:', error);
        }
    }, 60000);
    
    // Relayer health check (every 2 minutes)
    setInterval(async () => {
        try {
            await services.relayer.checkRelayerHealth();
        } catch (error) {
            logger.error('Error checking relayer health:', error);
        }
    }, 120000);
    
    logger.info('Background workers started');
}

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connections, cache, etc.
        Promise.all([
            services.dataDAO?.cleanup(),
            services.analytics?.cleanup(),
            services.feeds?.cleanup(),
            services.audit?.cleanup(),
            services.relayer?.cleanup()
        ]).then(() => {
            logger.info('All services cleaned up');
            process.exit(0);
        }).catch((error) => {
            logger.error('Error during cleanup:', error);
            process.exit(1);
        });
    });
}

// Start server
async function startServer() {
    try {
        await initializeServices();
        
        server.listen(PORT, () => {
            logger.info(`🚀 ZKVault Backend Server running on port ${PORT}`);
            logger.info(`📊 Environment: ${NODE_ENV}`);
            logger.info(`🔗 WebSocket server ready`);
            logger.info(`📡 API endpoints available at /api/*`);
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer();

export { app, io, services };
