const jwt = require('jsonwebtoken');
const { User } = require('../models/associations');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findByPk(decoded.id);

      if (!req.user || !req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Check if user is board member
const isBoardMember = (requiredRole = 'member') => {
  return async (req, res, next) => {
    try {
      const { BoardMember } = require('../models/associations');
      const boardId = req.params.boardId || req.body.boardId;

      const membership = await BoardMember.findOne({
        where: {
          boardId,
          userId: req.user.id
        }
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this board'
        });
      }

      const roleHierarchy = { owner: 3, admin: 2, member: 1 };
      if (roleHierarchy[membership.role] < roleHierarchy[requiredRole]) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required: ${requiredRole}`
        });
      }

      req.boardMembership = membership;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking board membership'
      });
    }
  };
};

module.exports = { protect, isBoardMember };
