const { List, Card, Activity, Board } = require('../models/associations');
const { cacheDel } = require('../config/redis');

// @desc    Create new list
// @route   POST /api/boards/:boardId/lists
// @access  Private
exports.createList = async (req, res, next) => {
  try {
    const { title, position } = req.body;
    const { boardId } = req.params;

    // Get max position if not provided
    let listPosition = position;
    if (listPosition === undefined) {
      const maxList = await List.findOne({
        where: { boardId },
        order: [['position', 'DESC']]
      });
      listPosition = maxList ? maxList.position + 1 : 0;
    }

    const list = await List.create({
      title,
      position: listPosition,
      boardId
    });

    // Log activity
    await Activity.create({
      type: 'list',
      action: 'created',
      entityType: 'list',
      entityId: list.id,
      boardId,
      userId: req.user.id,
      data: { title: list.title }
    });

    // Clear cache
    await cacheDel(`board_${boardId}`);

    res.status(201).json({
      success: true,
      message: 'List created successfully',
      data: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update list
// @route   PUT /api/lists/:id
// @access  Private
exports.updateList = async (req, res, next) => {
  try {
    const { title, position } = req.body;

    const list = await List.findByPk(req.params.id);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    if (title) list.title = title;
    if (position !== undefined) list.position = position;

    await list.save();

    // Log activity
    await Activity.create({
      type: 'list',
      action: 'updated',
      entityType: 'list',
      entityId: list.id,
      boardId: list.boardId,
      userId: req.user.id,
      data: { title: list.title }
    });

    // Clear cache
    await cacheDel(`board_${list.boardId}`);

    res.json({
      success: true,
      message: 'List updated successfully',
      data: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete list
// @route   DELETE /api/lists/:id
// @access  Private
exports.deleteList = async (req, res, next) => {
  try {
    const list = await List.findByPk(req.params.id);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    const boardId = list.boardId;
    await list.destroy();

    // Clear cache
    await cacheDel(`board_${boardId}`);

    res.json({
      success: true,
      message: 'List deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive list
// @route   PUT /api/lists/:id/archive
// @access  Private
exports.archiveList = async (req, res, next) => {
  try {
    const list = await List.findByPk(req.params.id);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    list.isArchived = true;
    await list.save();

    // Log activity
    await Activity.create({
      type: 'list',
      action: 'archived',
      entityType: 'list',
      entityId: list.id,
      boardId: list.boardId,
      userId: req.user.id,
      data: { title: list.title }
    });

    // Clear cache
    await cacheDel(`board_${list.boardId}`);

    res.json({
      success: true,
      message: 'List archived successfully',
      data: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore archived list
// @route   PUT /api/lists/:id/restore
// @access  Private
exports.restoreList = async (req, res, next) => {
  try {
    const list = await List.findByPk(req.params.id);
    if (!list) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    list.isArchived = false;
    await list.save();

    // Clear cache
    await cacheDel(`board_${list.boardId}`);

    res.json({
      success: true,
      message: 'List restored successfully',
      data: list
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reorder lists
// @route   PUT /api/boards/:boardId/lists/reorder
// @access  Private
exports.reorderLists = async (req, res, next) => {
  try {
    const { listOrders } = req.body; // Array of { id, position }
    const { boardId } = req.params;

    // Update positions
    for (const item of listOrders) {
      await List.update(
        { position: item.position },
        { where: { id: item.id, boardId } }
      );
    }

    // Clear cache
    await cacheDel(`board_${boardId}`);

    res.json({
      success: true,
      message: 'Lists reordered successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Copy list
// @route   POST /api/lists/:id/copy
// @access  Private
exports.copyList = async (req, res, next) => {
  try {
    const { title } = req.body;
    
    const originalList = await List.findByPk(req.params.id, {
      include: [
        {
          model: Card,
          as: 'cards',
          where: { isArchived: false },
          required: false
        }
      ]
    });

    if (!originalList) {
      return res.status(404).json({
        success: false,
        message: 'List not found'
      });
    }

    // Get next position
    const maxList = await List.findOne({
      where: { boardId: originalList.boardId },
      order: [['position', 'DESC']]
    });
    const newPosition = maxList ? maxList.position + 1 : 0;

    // Create new list
    const newList = await List.create({
      title: title || `${originalList.title} (Copy)`,
      position: newPosition,
      boardId: originalList.boardId
    });

    // Copy cards
    for (const card of originalList.cards) {
      await Card.create({
        title: card.title,
        description: card.description,
        position: card.position,
        dueDate: card.dueDate,
        listId: newList.id,
        createdBy: req.user.id
      });
    }

    // Clear cache
    await cacheDel(`board_${originalList.boardId}`);

    res.status(201).json({
      success: true,
      message: 'List copied successfully',
      data: newList
    });
  } catch (error) {
    next(error);
  }
};
