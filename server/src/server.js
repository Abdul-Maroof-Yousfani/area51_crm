// Load .env Enviroment Variables to process.env
import 'dotenv/config';

// Require Dependencies
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import customError from 'express-custom-error';
import { createServer } from 'http';
import { Server } from 'socket.io';
const { inject, errorHandler } = customError;

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import logger from './util/logger.js';
import router from './routes/router.js';

// Patches
inject(); // Patch express in order to use async / await syntax

// Instantiate an Express Application
const app = express();

// Configure Express App Instance
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure custom logger middleware
app.use(logger.dev, logger.combined);

app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:3000'],
    credentials: true
}));
app.use(helmet());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// This middleware adds the json header to API responses
app.use('/api/*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
})

// Assign Routes
import notificationRoutes from './routes/notifications.js';

app.use('/api', router);
app.use('/api/notifications', notificationRoutes);

// Handle errors
app.use(errorHandler());

// Handle API 404
app.use('/api/*', (req, res) => {
    res
        .status(404)
        .json({ status: false, message: 'Endpoint Not Found' });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Open Server on selected Port
const PORT = process.env.PORT || 3006;
const httpServer = createServer(app);

// Initialize Socket.IO
import { initSocket } from './util/socket.js';
initSocket(httpServer);

httpServer.listen(PORT, () => console.info('Server listening on port ', PORT));

httpServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Run: taskkill /F /IM node.exe`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
    }
});