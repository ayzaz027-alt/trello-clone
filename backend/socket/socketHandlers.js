const jwt = require('jsonwebtoken');
const { User } = require('../models/associations');

const socketHandlers = (io) => {
  // Authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userName = user.name;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userName} (${socket.userId})`);

    // Join board room
    socket.on('join-board', (boardId) => {
      socket.join(`board-${boardId}`);
      console.log(`User ${socket.userName} joined board ${boardId}`);
      
      // Notify others in the board
      socket.to(`board-${boardId}`).emit('user-joined', {
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Leave board room
    socket.on('leave-board', (boardId) => {
      socket.leave(`board-${boardId}`);
      console.log(`User ${socket.userName} left board ${boardId}`);
      
      socket.to(`board-${boardId}`).emit('user-left', {
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Card created
    socket.on('card-created', (data) => {
      socket.to(`board-${data.boardId}`).emit('card-created', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Card updated
    socket.on('card-updated', (data) => {
      socket.to(`board-${data.boardId}`).emit('card-updated', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Card deleted
    socket.on('card-deleted', (data) => {
      socket.to(`board-${data.boardId}`).emit('card-deleted', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Card moved
    socket.on('card-moved', (data) => {
      socket.to(`board-${data.boardId}`).emit('card-moved', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // List created
    socket.on('list-created', (data) => {
      socket.to(`board-${data.boardId}`).emit('list-created', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // List updated
    socket.on('list-updated', (data) => {
      socket.to(`board-${data.boardId}`).emit('list-updated', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // List deleted
    socket.on('list-deleted', (data) => {
      socket.to(`board-${data.boardId}`).emit('list-deleted', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Comment added
    socket.on('comment-added', (data) => {
      socket.to(`board-${data.boardId}`).emit('comment-added', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Member assigned to card
    socket.on('member-assigned', (data) => {
      socket.to(`board-${data.boardId}`).emit('member-assigned', {
        ...data,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    // Typing indicator
    socket.on('typing-start', (data) => {
      socket.to(`board-${data.boardId}`).emit('user-typing', {
        cardId: data.cardId,
        userId: socket.userId,
        userName: socket.userName
      });
    });

    socket.on('typing-stop', (data) => {
      socket.to(`board-${data.boardId}`).emit('user-stopped-typing', {
        cardId: data.cardId,
        userId: socket.userId
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userName}`);
    });
  });
};

module.exports = socketHandlers;
