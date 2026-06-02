const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const c = require('../controllers/reminderController');

router.get('/', auth, c.getReminders);
router.post('/', auth, c.createReminder);
router.get('/templates', auth, c.getTemplates);
router.post('/templates', auth, c.createTemplate);
router.put('/templates/:id', auth, c.updateTemplate);
router.delete('/templates/:id', auth, c.deleteTemplate);
router.put('/:id/status', auth, c.updateStatus);
router.delete('/:id', auth, c.deleteReminder);

module.exports = router;
