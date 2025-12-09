const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import configurations
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const socketHandlers = require('./socket/socketHandlers');

// Import models and associations
require('./models/associations');

// Import routes
const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const listRoutes = require('./routes/lists');
const cardRoutes = require('./routes/cards');
const { createList } = require('./controllers/listController');
const { createCard } = require('./controllers/cardController');
const { protect } = require('./middleware/auth');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Socket.IO handlers
socketHandlers(io);

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/cards', cardRoutes);

// List creation under board
app.post('/api/boards/:boardId/lists', protect, createList);

// Card creation under list
app.post('/api/lists/:listId/cards', protect, createCard);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handler
app.use(errorHandler);

// Server initialization
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Connect to Redis
    await connectRedis();
    
    // Start server
    server.listen(PORT, () => {
      console.log('╔═══════════════════════════════════════════╗');
      console.log('║                                           ║');
      console.log('║   🚀 TRELLO CLONE SERVER STARTED 🚀      ║');
      console.log('║                                           ║');
      console.log('╚═══════════════════════════════════════════╝');
      console.log(`\n✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Server running on port: ${PORT}`);
      console.log(`✅ API URL: http://localhost:${PORT}/api`);
      console.log(`✅ Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log('\n📡 WebSocket server ready for real-time updates');
      console.log('\n💡 Press Ctrl+C to stop the server\n');
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down server...');
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = { app, server, io };
