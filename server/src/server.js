// Load .env Enviroment Variables to process.env
import 'dotenv/config';

// Require Dependencies
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import customError from 'express-custom-error';
const { inject, errorHandler } = customError;

import logger from './util/logger.js';
import router from './routes/router.js';

// Patches
inject(); // Patch express in order to use async / await syntax

const { PORT } = process.env;

// Instantiate an Express Application
const app = express();

// Configure Express App Instance
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure custom logger middleware
app.use(logger.dev, logger.combined);

app.use(cookieParser());
app.use(cors());
app.use(helmet());

// This middleware adds the json header to every response
app.use('*', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
})

// Assign Routes
app.use('/api', router);

// Handle errors
app.use(errorHandler());

// Handle not valid route
app.use('*', (req, res) => {
    res
        .status(404)
        .json({ status: false, message: 'Endpoint Not Found' });
})

// Open Server on selected Port
app.listen(
    PORT || 3005,
    () => console.info('Server listening on port ', PORT)
);