const express = require('express');
const router = express.Router();
const {
  getCard,
  updateCard,
  deleteCard,
  assignMember,
  removeMember,
  addLabel,
  removeLabel,
  addComment,
  archiveCard,
  moveCard
} = require('../controllers/cardController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Card operations
router.route('/:id')
  .get(getCard)
  .put(updateCard)
  .delete(deleteCard);

// Card members
router.post('/:id/members', assignMember);
router.delete('/:id/members/:userId', removeMember);

// Card labels
router.post('/:id/labels', addLabel);
router.delete('/:id/labels/:labelId', removeLabel);

// Card comments
router.post('/:id/comments', addComment);

// Card actions
router.put('/:id/archive', archiveCard);
router.put('/:id/move', moveCard);

module.exports = router;
