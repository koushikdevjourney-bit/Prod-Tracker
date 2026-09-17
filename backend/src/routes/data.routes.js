const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/data.controller');

const router = express.Router();

router.use(protect);

router.get('/data', ctrl.snapshot);
router.delete('/data', ctrl.clearAll);
router.post('/data/import', ctrl.importSnapshot);

router.get('/activities', ctrl.listActivities);
router.post('/activities', ctrl.createActivity);
router.put('/activities/:id', ctrl.updateActivity);
router.delete('/activities/:id', ctrl.deleteActivity);

router.get('/goals', ctrl.listGoals);
router.post('/goals', ctrl.createGoal);
router.put('/goals/:id', ctrl.updateGoal);
router.delete('/goals/:id', ctrl.deleteGoal);

router.get('/habits', ctrl.listHabits);
router.post('/habits', ctrl.createHabit);
router.put('/habits/:id', ctrl.updateHabit);
router.patch('/habits/:id/toggle', ctrl.toggleHabit);
router.delete('/habits/:id', ctrl.deleteHabit);

router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

router.get('/grit', ctrl.getGrit);
router.put('/grit', ctrl.saveGrit);

module.exports = router;
