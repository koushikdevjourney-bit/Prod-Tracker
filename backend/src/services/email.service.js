const { Resend } = require('resend');
const nodemailer = require('nodemailer');

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function createSmtpTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!pass) return null;

  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: { user, pass },
  });
}

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_PASS);
}

function buildReminderHtml(userName = 'Koushik', currentHourStr = '') {
  const clientUrl = (process.env.CLIENT_ORIGIN || 'https://prod-tracker-alpha.vercel.app').split(',')[0].trim();
  const activitiesUrl = `${clientUrl}/activities`;
  const progressUrl = `${clientUrl}/progress`;
  const todoUrl = `${clientUrl}/focused-todo`;
  const settingsUrl = `${clientUrl}/settings`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hourly Productivity Check-in</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#1e293b;border-radius:18px;border:1px solid #334155;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.4);">
          <!-- Header Banner -->
          <tr>
            <td style="padding:28px 32px 20px;background:linear-gradient(135deg,#0284c7 0%,#0d9488 100%);text-align:left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display:inline-block;padding:4px 10px;background:rgba(255,255,255,0.22);border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#ffffff;margin-bottom:8px;">Hourly Check-In ${currentHourStr ? '· ' + currentHourStr : ''}</span>
                    <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">Pulse Productivity Tracker</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#f8fafc;">
                Hey <strong>${userName}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">
                What did you accomplish during the past hour? Taking 30 seconds right now keeps your daily timeline accurate, logs your focus, and powers your streak.
              </p>

              <!-- Main CTA Button -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${activitiesUrl}" target="_blank" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0284c7 0%,#0d9488 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;border-radius:12px;box-shadow:0 6px 20px rgba(2,132,199,0.35);letter-spacing:-0.01em;">
                      ⚡ Log Past Hour's Activity →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Quick Links Box -->
              <div style="background-color:#0f172a;border-radius:12px;border:1px solid #334155;padding:16px;margin:20px 0 0;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;">Quick Jump</p>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding:4px 0;">
                      <a href="${progressUrl}" target="_blank" style="color:#38bdf8;text-decoration:none;font-size:13px;font-weight:600;">🎯 Open Progress & Pomodoro Timer</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;">
                      <a href="${todoUrl}" target="_blank" style="color:#38bdf8;text-decoration:none;font-size:13px;font-weight:600;">✓ View Current Focused To-Do</a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px;border-top:1px solid #334155;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#64748b;">
                Sent automatically by your Pulse Productivity Tracker.
              </p>
              <p style="margin:0;font-size:11px;color:#475569;">
                To adjust reminder hours or turn these off, visit your <a href="${settingsUrl}" target="_blank" style="color:#94a3b8;text-decoration:underline;">Account Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmailMessage({ toEmail, subject, html }) {
  const resend = getResendClient();
  if (resend) {
    const from = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const { data, error } = await resend.emails.send({
      from: `Pulse Tracker <${from}>`,
      to: [toEmail],
      subject,
      html,
    });

    if (error) {
      throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
    }

    return { success: true, provider: 'resend', messageId: data?.id };
  }

  const transporter = createSmtpTransporter();
  if (transporter) {
    const fromUser = process.env.EMAIL_USER || 'koushiksai242@gmail.com';
    const info = await transporter.sendMail({
      from: `"Pulse Tracker" <${fromUser}>`,
      to: toEmail,
      subject,
      html,
    });
    return { success: true, provider: 'smtp', messageId: info.messageId };
  }

  throw new Error('Neither RESEND_API_KEY nor EMAIL_PASS is configured.');
}

async function sendHourlyReminder(toEmail, userName = 'Koushik', currentHourStr = '') {
  if (!isEmailConfigured()) {
    console.warn(`[Email Service] Neither RESEND_API_KEY nor EMAIL_PASS set. Skipping reminder to ${toEmail}.`);
    return { success: false, skipped: true, message: 'Email credentials not configured' };
  }

  const subject = `🕒 Hourly Check-in: Log your past hour's activity`;
  const html = buildReminderHtml(userName, currentHourStr);

  return sendEmailMessage({ toEmail, subject, html });
}

async function sendTestEmail(toEmail, userName = 'Koushik') {
  const subject = `✅ Pulse Tracker: Hourly Reminders Connected!`;
  const html = buildReminderHtml(userName, 'Test Notification');

  return sendEmailMessage({ toEmail, subject, html });
}

module.exports = {
  isEmailConfigured,
  sendHourlyReminder,
  sendTestEmail,
};
