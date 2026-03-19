const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const CLIENT_SECRET = process.env.KICK_CLIENT_SECRET || '7a7c58df97fe5f34a85f5890c5b426ae4dca25607ddf86594d9b12163b4535bd';
const PORT = process.env.PORT || 3000;

// Clientes WebSocket conectados (las páginas HTML)
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Cliente conectado. Total: ${clients.size}`);
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Cliente desconectado. Total: ${clients.size}`);
  });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Verificar firma de Kick
function verifySignature(req, rawBody) {
  const msgId        = req.headers['kick-event-message-id']        || '';
  const msgTimestamp = req.headers['kick-event-message-timestamp']  || '';
  const signature    = req.headers['kick-event-signature']          || '';

  const hmacMessage = msgId + msgTimestamp + rawBody;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', CLIENT_SECRET)
    .update(hmacMessage)
    .digest('hex');

  return signature === expected;
}

// Leer body raw para verificar firma
app.use('/webhook', express.raw({ type: '*/*' }));
app.use(express.json());

// Health check
app.get('/', (req, res) => res.send('Aurometro server OK'));

// Webhook de Kick
app.post('/webhook', (req, res) => {
  const rawBody = req.body.toString('utf8');

  // Verificar firma (si Kick la manda)
  const sig = req.headers['kick-event-signature'];
  if (sig && !verifySignature(req, rawBody)) {
    console.log('Firma inválida');
    return res.status(403).send('Invalid signature');
  }

  let payload;
  try { payload = JSON.parse(rawBody); } catch(e) {
    return res.status(400).send('Bad JSON');
  }

  const eventType = req.headers['kick-event-type'] || payload?.type || '';
  console.log('Evento recibido:', eventType, JSON.stringify(payload).slice(0, 120));

  // Evento de mensaje de chat
  if (eventType === 'chat.message.sent' || eventType.includes('chat')) {
    const content = (
      payload?.data?.content ||
      payload?.data?.message?.content ||
      payload?.message?.content ||
      payload?.content || ''
    ).toLowerCase().trim();

    const sender = 
      payload?.data?.sender?.username ||
      payload?.data?.chatter?.username ||
      payload?.sender?.username || '?';

    const hasAura  = /\baura\b/.test(content);
    const hasLaura = /\blaura\b/.test(content);

    if (hasAura || hasLaura) {
      broadcast({
        type: hasAura ? 'aura' : 'laura',
        user: sender,
        msg: payload?.data?.content || payload?.data?.message?.content || content
      });
    }
  }

  res.status(200).send('OK');
});

server.listen(PORT, () => {
  console.log(`Aurometro server corriendo en puerto ${PORT}`);
});
