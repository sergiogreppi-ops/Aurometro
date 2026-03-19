const express = require('express');
const { createServer } = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

const app    = express();
const server = createServer(app);
const wss    = new WebSocketServer({ server });

const PORT         = process.env.PORT         || 3000;
const CHATROOM_ID  = process.env.CHATROOM_ID  || '30874569'; // khandbl
const PUSHER_URL   = 'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0-rc2&flash=false';

// ── Clientes HTML conectados ───────────────────────────────────────────────
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`HTML cliente conectado. Total: ${clients.size}`);
  ws.on('close', () => { clients.delete(ws); console.log(`HTML cliente desconectado. Total: ${clients.size}`); });
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const c of clients) if (c.readyState === 1) c.send(msg);
}

// ── Conexión a Pusher (Kick) ───────────────────────────────────────────────
let kickWs       = null;
let pingInterval = null;
let reconnectTimeout = null;

function connectToKick() {
  if (kickWs) { try { kickWs.terminate(); } catch(e){} kickWs = null; }
  clearInterval(pingInterval);
  clearTimeout(reconnectTimeout);

  console.log(`Conectando a Kick chat (sala ${CHATROOM_ID})...`);

  kickWs = new WebSocket(PUSHER_URL, {
    headers: {
      'Origin': 'https://kick.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  kickWs.on('open', () => {
    console.log('Conectado a Pusher/Kick');
    kickWs.send(JSON.stringify({
      event: 'pusher:subscribe',
      data:  { auth: '', channel: `chatrooms.${CHATROOM_ID}.v2` }
    }));
    // Ping cada 25s para mantener conexión viva
    pingInterval = setInterval(() => {
      if (kickWs?.readyState === 1)
        kickWs.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
    }, 25000);
  });

  kickWs.on('message', (raw) => {
    try {
      const pkt = JSON.parse(raw.toString());
      const ev  = pkt.event || '';

      if (ev === 'pusher:pong' || ev === 'pusher:connection_established') return;

      console.log('Kick evento:', ev, String(raw).slice(0, 150));

      if (ev.includes('ChatMessage') || ev === 'App\\Events\\ChatMessageEvent') {
        const payload = typeof pkt.data === 'string' ? JSON.parse(pkt.data) : pkt.data;

        const content  = (payload?.message?.content || payload?.content || '').toLowerCase().trim();
        const sender   = payload?.sender?.username || payload?.message?.sender?.username || '?';
        const original = payload?.message?.content || payload?.content || content;

        const hasAura  = /\baura\b/.test(content);
        const hasLaura = /\blaura\b/.test(content);

        if (hasLaura) { console.log(`VOTO LAURA de ${sender}`); broadcast({ type: 'laura', user: sender, msg: original }); }
        if (hasAura)  { console.log(`VOTO AURA de ${sender}`);  broadcast({ type: 'aura',  user: sender, msg: original }); }
      }
    } catch(e) { console.error('Parse error:', e.message); }
  });

  kickWs.on('error', (e) => console.error('Kick WS error:', e.message));

  kickWs.on('close', (code, reason) => {
    console.log(`Kick WS cerrado (${code}). Reintentando en 5s...`);
    clearInterval(pingInterval);
    reconnectTimeout = setTimeout(connectToKick, 5000);
  });
}

// ── Health check ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const connected = kickWs?.readyState === 1;
  res.send(`
    <h2>Aurometro Server</h2>
    <p>Kick chat: ${connected ? '🟢 Conectado' : '🔴 Desconectado'}</p>
    <p>Clientes HTML: ${clients.size}</p>
    <p>Sala: ${CHATROOM_ID} (khandbl)</p>
  `);
});

// ── Arrancar ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Aurometro server en puerto ${PORT}`);
  connectToKick();
});
