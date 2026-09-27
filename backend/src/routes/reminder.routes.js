const express = require('express');
const { sendTestEmail, isEmailConfigured } = require('../services/email.service');
const { processHourlyReminders, getSchedulerStatus } = require('../services/reminder.scheduler');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * GET /api/reminders/status
 * Check if the email service is ready and scheduler state
 */
router.get('/status', (req, res) => {
  const scheduler = getSchedulerStatus();
  return res.json({
    configured: isEmailConfigured(),
    senderEmail: process.env.EMAIL_USER || 'koushiksai242@gmail.com',
    scheduler,
  });
});

/**
 * POST /api/reminders/send-test
 * Sends a test check-in email to the user
 */
router.post('/send-test', async (req, res, next) => {
  try {
    const toEmail = req.body.email || process.env.EMAIL_USER || 'koushiksai242@gmail.com';
    const userName = req.body.name || 'Koushik';

    const result = await sendTestEmail(toEmail, userName);
    return res.json({
      success: true,
      message: `Test reminder email sent to ${toEmail}!`,
      details: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Could not send test email',
    });
  }
});

/**
 * GET or POST /api/reminders/trigger-hourly
 * Manually or externally trigger the hourly dispatch
 * Can be called by cron-job.org or GitHub Actions
 */
router.all('/trigger-hourly', async (req, res) => {
  // Optional security token check if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.query.secret || req.headers['x-cron-secret'];

  if (cronSecret && providedSecret !== cronSecret) {
    return res.status(401).json({ message: 'Unauthorized cron trigger' });
  }

  const result = await processHourlyReminders();
  return res.json(result);
});

module.exports = router;
