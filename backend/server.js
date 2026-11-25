const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDatabase, close } = require('./config/db');
const movieRoutes = require('./routes/movieRoutes');
const showtimeRoutes = require('./routes/showtimeRoutes');
const seatRoutes = require('./routes/seatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow Vite dev server and production clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Cinema Booking System Backend',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/movies', movieRoutes);
app.use('/api/showtimes', showtimeRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve static frontend build in production (e.g., Render, Railway, Docker)
const frontendDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDist)) {
  console.log(`[Static] Serving frontend static assets from ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Centralized Error Handler
app.use(errorHandler);

// Graceful Shutdown helper
let serverInstance = null;

async function startServer() {
  try {
    // 1. Initialize DB connection
    await initDatabase();

    // 2. Start HTTP server
    serverInstance = app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🍿 Cinema Booking Server running on http://localhost:${PORT}`);
      console.log(`🔒 Mutex Synchronization Layer: PostgreSQL SELECT FOR UPDATE`);
      console.log(`=======================================================`);
    });

    return serverInstance;
  } catch (err) {
    console.error('Fatal failure starting server:', err);
    process.exit(1);
  }
}

// Graceful cleanup
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  if (serverInstance) {
    serverInstance.close(() => {
      console.log('HTTP server closed.');
    });
  }
  await close();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
