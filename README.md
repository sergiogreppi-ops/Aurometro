# Aurometro — Setup

## Archivos
- `server.js` → va a Railway (recibe webhooks de Kick, transmite por WebSocket)
- `index.html` → va a GitHub Pages (muestra el contador)

---

## Paso 1 — Deploy en Railway

1. Subí esta carpeta a un repo de GitHub (solo `server.js`, `package.json`, `Procfile`)
2. En Railway → New Project → Deploy from GitHub repo
3. Agregá esta variable de entorno en Railway:
   ```
   KICK_CLIENT_SECRET=7a7c58df97fe5f34a85f5890c5b426ae4dca25607ddf86594d9b12163b4535bd
   ```
4. Railway te da una URL tipo: `https://aurometro-production.up.railway.app`

---

## Paso 2 — Configurar webhook en Kick

1. Andá al panel de desarrollador de Kick
2. En tu app "Aurometro", habilitá webhooks
3. URL del webhook:
   ```
   https://aurometro-production.up.railway.app/webhook
   ```
4. Suscribite al evento: **chat.message.sent**

---

## Paso 3 — GitHub Pages

1. Subí `index.html` a tu repo `sergiogreppi-ops/Aurometro`
2. La URL será: `https://sergiogreppi-ops.github.io/Aurometro/`
3. Abrí esa URL, pegá la URL de Railway en el campo y presioná Conectar

---

## Cómo funciona

```
Chat de Kick
    ↓
Kick manda POST a Railway /webhook
    ↓
Railway detecta "aura" o "laura"
    ↓
Railway manda por WebSocket a todos los clientes
    ↓
index.html actualiza el contador en tiempo real
```
