const express = require('express');
const router = express.Router();
const {
  createList,
  updateList,
  deleteList,
  archiveList,
  restoreList,
  reorderLists,
  copyList
} = require('../controllers/listController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// List operations
router.put('/:id', updateList);
router.delete('/:id', deleteList);
router.put('/:id/archive', archiveList);
router.put('/:id/restore', restoreList);
router.post('/:id/copy', copyList);

module.exports = router;
