const { 
  Card, 
  List, 
  User, 
  Label, 
  Comment, 
  Checklist, 
  Attachment,
  CardMember, 
  CardLabel,
  Activity,
  Notification
} = require('../models/associations');
const { sendEmail, emailTemplates } = require('../config/email');
const { cacheDel } = require('../config/redis');

// @desc    Create new card
// @route   POST /api/lists/:listId/cards
// @access  Private
exports.createCard = async (req, res, next) => {
  try {
    const { title, description, position } = req.body;
    const { listId } = req.params;

    const list = await List.findByPk(listId);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    // Get max position if not provided
    let cardPosition = position;
    if (cardPosition === undefined) {
      const maxCard = await Card.findOne({
        where: { listId },
        order: [['position', 'DESC']]
      });
      cardPosition = maxCard ? maxCard.position + 1 : 0;
    }

    const card = await Card.create({
      title,
      description: description || '',
      position: cardPosition,
      listId,
      createdBy: req.user.id
    });

    // Log activity
    await Activity.create({
      type: 'card',
      action: 'created',
      entityType: 'card',
      entityId: card.id,
      boardId: list.boardId,
      userId: req.user.id,
      data: { title: card.title, listTitle: list.title }
    });

    // Clear cache
    await cacheDel(`board_${list.boardId}`);

    const fullCard = await Card.findByPk(card.id, {
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
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Card created successfully',
      data: fullCard
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get card details
// @route   GET /api/cards/:id
// @access  Private
exports.getCard = async (req, res, next) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [
        {
          model: List,
          as: 'list'
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'name', 'email', 'avatar']
        },
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
        },
        {
          model: Comment,
          as: 'comments',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'avatar']
            }
          ],
          order: [['createdAt', 'DESC']]
        },
        {
          model: Checklist,
          as: 'checklists'
        },
        {
          model: Attachment,
          as: 'attachments',
          include: [
            {
              model: User,
              as: 'uploader',
              attributes: ['id', 'name', 'avatar']
            }
          ]
        }
      ]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    res.json({
      success: true,
      data: card
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update card
// @route   PUT /api/cards/:id
// @access  Private
exports.updateCard = async (req, res, next) => {
  try {
    const { 
      title, 
      description, 
      dueDate, 
      isCompleted, 
      cover, 
      position,
      listId 
    } = req.body;

    const card = await Card.findByPk(req.params.id, {
      include: [{ model: List, as: 'list' }]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    const oldListId = card.listId;

    if (title) card.title = title;
    if (description !== undefined) card.description = description;
    if (dueDate !== undefined) card.dueDate = dueDate;
    if (cover !== undefined) card.cover = cover;
    if (position !== undefined) card.position = position;
    if (listId !== undefined) card.listId = listId;

    if (isCompleted !== undefined) {
      card.isCompleted = isCompleted;
      card.completedAt = isCompleted ? new Date() : null;
    }

    await card.save();

    // Log activity
    await Activity.create({
      type: 'card',
      action: 'updated',
      entityType: 'card',
      entityId: card.id,
      boardId: card.list.boardId,
      userId: req.user.id,
      data: { title: card.title }
    });

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);
    if (oldListId !== card.listId) {
      const newList = await List.findByPk(card.listId);
      await cacheDel(`board_${newList.boardId}`);
    }

    const updatedCard = await Card.findByPk(card.id, {
      include: [
        { model: User, as: 'members', through: { attributes: [] } },
        { model: Label, as: 'labels', through: { attributes: [] } }
      ]
    });

    res.json({
      success: true,
      message: 'Card updated successfully',
      data: updatedCard
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete card
// @route   DELETE /api/cards/:id
// @access  Private
exports.deleteCard = async (req, res, next) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [{ model: List, as: 'list' }]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    const boardId = card.list.boardId;
    await card.destroy();

    // Clear cache
    await cacheDel(`board_${boardId}`);

    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign member to card
// @route   POST /api/cards/:id/members
// @access  Private
exports.assignMember = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const cardId = req.params.id;

    const card = await Card.findByPk(cardId, {
      include: [{ model: List, as: 'list' }]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    // Check if already assigned
    const existing = await CardMember.findOne({
      where: { cardId, userId }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Member already assigned to this card'
      });
    }

    await CardMember.create({ cardId, userId });

    const user = await User.findByPk(userId);

    // Send notification email
    const list = await List.findByPk(card.listId, {
      include: [{ model: require('./Board'), as: 'board' }]
    });
    const board = list.board;

    const emailContent = emailTemplates.cardAssigned(
      card.title,
      board.title,
      req.user.name,
      card.id
    );
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html
    });

    // Create notification
    await Notification.create({
      type: 'card_assigned',
      title: 'Card Assignment',
      message: `You were assigned to "${card.title}"`,
      data: { cardId: card.id, cardTitle: card.title },
      userId
    });

    // Log activity
    await Activity.create({
      type: 'card',
      action: 'member_assigned',
      entityType: 'card',
      entityId: card.id,
      boardId: card.list.boardId,
      userId: req.user.id,
      data: { cardTitle: card.title, memberName: user.name }
    });

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);

    res.json({
      success: true,
      message: 'Member assigned successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove member from card
// @route   DELETE /api/cards/:id/members/:userId
// @access  Private
exports.removeMember = async (req, res, next) => {
  try {
    const { id: cardId, userId } = req.params;

    const cardMember = await CardMember.findOne({
      where: { cardId, userId }
    });

    if (!cardMember) {
      return res.status(404).json({
        success: false,
        message: 'Member not found on this card'
      });
    }

    await cardMember.destroy();

    const card = await Card.findByPk(cardId, {
      include: [{ model: List, as: 'list' }]
    });

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add label to card
// @route   POST /api/cards/:id/labels
// @access  Private
exports.addLabel = async (req, res, next) => {
  try {
    const { labelId } = req.body;
    const cardId = req.params.id;

    const existing = await CardLabel.findOne({
      where: { cardId, labelId }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Label already added to this card'
      });
    }

    await CardLabel.create({ cardId, labelId });

    const card = await Card.findByPk(cardId, {
      include: [{ model: List, as: 'list' }]
    });

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);

    res.json({
      success: true,
      message: 'Label added successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove label from card
// @route   DELETE /api/cards/:id/labels/:labelId
// @access  Private
exports.removeLabel = async (req, res, next) => {
  try {
    const { id: cardId, labelId } = req.params;

    const cardLabel = await CardLabel.findOne({
      where: { cardId, labelId }
    });

    if (!cardLabel) {
      return res.status(404).json({
        success: false,
        message: 'Label not found on this card'
      });
    }

    await cardLabel.destroy();

    const card = await Card.findByPk(cardId, {
      include: [{ model: List, as: 'list' }]
    });

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);

    res.json({
      success: true,
      message: 'Label removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment to card
// @route   POST /api/cards/:id/comments
// @access  Private
exports.addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    const cardId = req.params.id;

    const card = await Card.findByPk(cardId, {
      include: [
        { model: List, as: 'list' },
        { model: User, as: 'members' }
      ]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    const comment = await Comment.create({
      text,
      cardId,
      userId: req.user.id
    });

    // Notify card members
    for (const member of card.members) {
      if (member.id !== req.user.id) {
        const emailContent = emailTemplates.commentNotification(
          card.title,
          req.user.name,
          text,
          card.id
        );
        await sendEmail({
          to: member.email,
          subject: emailContent.subject,
          html: emailContent.html
        });

        await Notification.create({
          type: 'comment',
          title: 'New Comment',
          message: `${req.user.name} commented on "${card.title}"`,
          data: { cardId: card.id, commentId: comment.id },
          userId: member.id
        });
      }
    }

    // Log activity
    await Activity.create({
      type: 'comment',
      action: 'created',
      entityType: 'comment',
      entityId: comment.id,
      boardId: card.list.boardId,
      userId: req.user.id,
      data: { cardTitle: card.title, commentText: text }
    });

    const fullComment = await Comment.findByPk(comment.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: fullComment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive card
// @route   PUT /api/cards/:id/archive
// @access  Private
exports.archiveCard = async (req, res, next) => {
  try {
    const card = await Card.findByPk(req.params.id, {
      include: [{ model: List, as: 'list' }]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    card.isArchived = true;
    await card.save();

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);

    res.json({
      success: true,
      message: 'Card archived successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Move card to different list
// @route   PUT /api/cards/:id/move
// @access  Private
exports.moveCard = async (req, res, next) => {
  try {
    const { listId, position } = req.body;

    const card = await Card.findByPk(req.params.id, {
      include: [{ model: List, as: 'list' }]
    });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }

    const oldListId = card.listId;
    card.listId = listId;
    card.position = position;
    await card.save();

    // Clear cache
    await cacheDel(`board_${card.list.boardId}`);
    if (oldListId !== listId) {
      const newList = await List.findByPk(listId);
      await cacheDel(`board_${newList.boardId}`);
    }

    res.json({
      success: true,
      message: 'Card moved successfully',
      data: card
    });
  } catch (error) {
    next(error);
  }
};
