const { Op } = require('sequelize');
const { 
  Board, 
  BoardMember, 
  List, 
  Card, 
  User, 
  Label,
  Activity 
} = require('../models/associations');
const { sendEmail, emailTemplates } = require('../config/email');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');

// @desc    Get all boards for user
// @route   GET /api/boards
// @access  Private
exports.getBoards = async (req, res, next) => {
  try {
    const cacheKey = `user_boards_${req.user.id}`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const boards = await Board.findAll({
      include: [
        {
          model: User,
          as: 'members',
          where: { id: req.user.id },
          through: { attributes: ['role'] }
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email', 'avatar']
        }
      ],
      where: { isClosed: false },
      order: [['isStarred', 'DESC'], ['createdAt', 'DESC']]
    });

    await cacheSet(cacheKey, boards, 600);

    res.json({
      success: true,
      data: boards
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single board with full details
// @route   GET /api/boards/:id
// @access  Private
exports.getBoard = async (req, res, next) => {
  try {
    const cacheKey = `board_${req.params.id}`;
    const cached = await cacheGet(cacheKey);
    
    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true
      });
    }

    const board = await Board.findByPk(req.params.id, {
      include: [
        {
          model: List,
          as: 'lists',
          where: { isArchived: false },
          required: false,
          include: [
            {
              model: Card,
              as: 'cards',
              where: { isArchived: false },
              required: false,
              include: [
                {
                  model: User,
                  as: 'members',
                  attributes: ['id', 'name', 'email', 'avatar'],
                  through: { attributes: [] }
                },
                {
                  model: Label,
                  as: 'labels',
                  through: { attributes: [] }
                }
              ],
              order: [['position', 'ASC']]
            }
          ],
          order: [['position', 'ASC']]
        },
        {
          model: User,
          as: 'members',
          attributes: ['id', 'name', 'email', 'avatar'],
          through: { attributes: ['role'] }
        },
        {
          model: Label,
          as: 'labels'
        },
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email', 'avatar']
        }
      ]
    });

    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Check if user is member
    const isMember = board.members.some(m => m.id === req.user.id);
    if (!isMember && board.visibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await cacheSet(cacheKey, board, 300);

    res.json({
      success: true,
      data: board
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new board
// @route   POST /api/boards
// @access  Private
exports.createBoard = async (req, res, next) => {
  try {
    const { title, description, background, backgroundType, visibility } = req.body;

    const board = await Board.create({
      title,
      description,
      background: background || '#0079BF',
      backgroundType: backgroundType || 'color',
      visibility: visibility || 'private',
      ownerId: req.user.id
    });

    // Add creator as owner member
    await BoardMember.create({
      boardId: board.id,
      userId: req.user.id,
      role: 'owner'
    });

    // Create default lists
    const defaultLists = ['To Do', 'In Progress', 'Done'];
    for (let i = 0; i < defaultLists.length; i++) {
      await List.create({
        title: defaultLists[i],
        position: i,
        boardId: board.id
      });
    }

    // Create default labels
    const defaultLabels = [
      { name: 'High Priority', color: '#EB5A46' },
      { name: 'Medium Priority', color: '#F2D600' },
      { name: 'Low Priority', color: '#61BD4F' },
      { name: 'Bug', color: '#C377E0' },
      { name: 'Feature', color: '#0079BF' }
    ];

    for (const label of defaultLabels) {
      await Label.create({
        ...label,
        boardId: board.id
      });
    }

    // Log activity
    await Activity.create({
      type: 'board',
      action: 'created',
      entityType: 'board',
      entityId: board.id,
      boardId: board.id,
      userId: req.user.id,
      data: { title: board.title }
    });

    // Clear cache
    await cacheDel(`user_boards_${req.user.id}`);

    const fullBoard = await Board.findByPk(board.id, {
      include: [
        { model: List, as: 'lists', order: [['position', 'ASC']] },
        { model: Label, as: 'labels' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Board created successfully',
      data: fullBoard
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update board
// @route   PUT /api/boards/:id
// @access  Private (Board Admin/Owner)
exports.updateBoard = async (req, res, next) => {
  try {
    const { title, description, background, backgroundType, visibility, isStarred } = req.body;

    const board = await Board.findByPk(req.params.id);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Update fields
    if (title) board.title = title;
    if (description !== undefined) board.description = description;
    if (background) board.background = background;
    if (backgroundType) board.backgroundType = backgroundType;
    if (visibility) board.visibility = visibility;
    if (isStarred !== undefined) board.isStarred = isStarred;

    await board.save();

    // Log activity
    await Activity.create({
      type: 'board',
      action: 'updated',
      entityType: 'board',
      entityId: board.id,
      boardId: board.id,
      userId: req.user.id,
      data: { title: board.title }
    });

    // Clear cache
    await cacheDel(`board_${board.id}`);
    await cacheDel(`user_boards_${req.user.id}`);

    res.json({
      success: true,
      message: 'Board updated successfully',
      data: board
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete board
// @route   DELETE /api/boards/:id
// @access  Private (Board Owner)
exports.deleteBoard = async (req, res, next) => {
  try {
    const board = await Board.findByPk(req.params.id);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Check if user is owner
    if (board.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only board owner can delete the board'
      });
    }

    await board.destroy();

    // Clear cache
    await cacheDel(`board_${board.id}`);
    await cacheDel(`user_boards_${req.user.id}`);

    res.json({
      success: true,
      message: 'Board deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Invite member to board
// @route   POST /api/boards/:id/members
// @access  Private (Board Admin/Owner)
exports.inviteMember = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const boardId = req.params.id;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Check if already member
    const existingMember = await BoardMember.findOne({
      where: { boardId, userId: user.id }
    });

    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this board'
      });
    }

    // Add member
    await BoardMember.create({
      boardId,
      userId: user.id,
      role: role || 'member'
    });

    const board = await Board.findByPk(boardId);

    // Send invitation email
    const emailContent = emailTemplates.boardInvitation(
      board.title,
      req.user.name,
      board.id
    );
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html
    });

    // Log activity
    await Activity.create({
      type: 'board',
      action: 'member_added',
      entityType: 'board',
      entityId: board.id,
      boardId: board.id,
      userId: req.user.id,
      data: { memberName: user.name }
    });

    // Clear cache
    await cacheDel(`board_${boardId}`);
    await cacheDel(`user_boards_${user.id}`);

    res.json({
      success: true,
      message: 'Member invited successfully',
      data: { user, role: role || 'member' }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from board
// @route   DELETE /api/boards/:id/members/:userId
// @access  Private (Board Admin/Owner)
exports.removeMember = async (req, res, next) => {
  try {
    const { id: boardId, userId } = req.params;

    const board = await Board.findByPk(boardId);
    if (!board) {
      return res.status(404).json({
        success: false,
        message: 'Board not found'
      });
    }

    // Cannot remove owner
    if (board.ownerId === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove board owner'
      });
    }

    const member = await BoardMember.findOne({
      where: { boardId, userId }
    });

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }

    await member.destroy();

    // Clear cache
    await cacheDel(`board_${boardId}`);
    await cacheDel(`user_boards_${userId}`);

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get board activities
// @route   GET /api/boards/:id/activities
// @access  Private
exports.getBoardActivities = async (req, res, next) => {
  try {
    const activities = await Activity.findAll({
      where: { boardId: req.params.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    next(error);
  }
};
