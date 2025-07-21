const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const publicFolder = path.join(__dirname, 'bomberGame');

const server = http.createServer((req, res) => {
  let filePath = path.join(publicFolder, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath).slice(1);

  const mimeTypes = {
    html: 'text/html',
    js: 'text/javascript',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    gif: 'image/gif',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const wss = new WebSocket.Server({ server });


let map = null;
const players = new Map(); // key = nickname, value = { ws, info }
const spawnPositions = [
  [1, 1],
  [1, 11],
  [9, 1],
  [9, 11]
];
const cols = 13, rows = 11;

function createInitialMap() {
  const m = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) row.push(1);
      else if (x % 2 === 0 && y % 2 === 0) row.push(1);
      else if ((x <= 1 && y <= 1) || (x >= cols - 2 && y <= 1) || (x <= 1 && y >= rows - 2) || (x >= cols - 2 && y >= rows - 2)) row.push(0);
      else row.push(Math.random() < 0.6 ? 2 : 0);
    }
    m.push(row);
  }

  m[1][2] = 0; m[2][1] = 0;
  m[1][cols - 3] = 0; m[2][cols - 2] = 0;
  m[rows - 3][1] = 0; m[rows - 2][2] = 0;
  m[rows - 3][cols - 2] = 0; m[rows - 2][cols - 3] = 0;

  return m;
}

wss.on('connection', (ws) => {
  console.log('✅ New client connected');

  let nickname = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());

    // First join
    if (data.type === 'join') {
      nickname = data.nickname;

      if (!map) {
        map = createInitialMap();
        console.log("🗺️ Map created");
      }

      const index = players.size;
      const spawn = spawnPositions[index]

      const playerInfo = {
        id: Date.now(),
        nickname,
        pos: spawn,
        color: ['#f00', '#0ff', '#f0f', '#0f0'][index % 4],
        lives: 3
      };

      players.set(nickname, { ws, info: playerInfo });

      // Send map + your info + other players
      ws.send(JSON.stringify({
        type: 'init',
        map,
        player: playerInfo,
        allPlayers: Array.from(players.values()).map(p => p.info)
      }));

      // Notify other players
      broadcast({
        type: 'new-player',
        player: playerInfo
      }, except = ws);
    }

    // Chat message
    if (data.type === 'chat') {
      broadcast(data);
    }

    // Player movement
    if (data.type === 'move') {
      // Update player position
      if (players.has(nickname)) {
        const player = players.get(nickname);
        player.info.pos = data.pos;
        
        // Broadcast movement to other players
        broadcast({
          type: 'player-moved',
          nickname: nickname,
          pos: data.pos
        }, except = ws);
      }
    }

    // Bomb placement
    if (data.type === 'place-bomb') {
      // Broadcast bomb placement to all players
      broadcast({
        type: 'bomb-placed',
        nickname: nickname,
        pos: data.pos,
        time: data.time
      });
    }

    // Explosion effect
    if (data.type === 'explosion') {
      // Broadcast explosion to all players
      broadcast({
        type: 'explosion-effect',
        nickname: nickname,
        explosionCells: data.explosionCells,
        time: data.time
      });
    }

    // Block destruction
    if (data.type === 'destroy-blocks') {
      // Broadcast block destruction to all players
      broadcast({
        type: 'blocks-destroyed',
        nickname: nickname,
        destroyedBlocks: data.destroyedBlocks,
        newPowerUps: data.newPowerUps
      });
    }

    // Power-up collection
    if (data.type === 'collect-powerup') {
      // Broadcast power-up collection to all players
      broadcast({
        type: 'powerup-collected',
        nickname: nickname,
        pos: data.pos,
        powerUpType: data.powerUpType
      });
    }
  });

  ws.on('close', () => {
    console.log('❌ Player disconnected');

    if (nickname && players.has(nickname)) {
      const { info } = players.get(nickname);
      players.delete(nickname);

      // Notify others player has left
      broadcast({
        type: 'player-left',
        nickname: nickname,
        id: info.id
      });
    }
  });
});

function broadcast(msg, except = null) {
  const text = JSON.stringify(msg);
  for (const { ws } of players.values()) {
    if (ws.readyState === WebSocket.OPEN && ws !== except) {
      ws.send(text);
    }
  }
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
