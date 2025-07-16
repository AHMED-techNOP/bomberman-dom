// app.js
// Use SimpleReact's globals directly (jsx, render, etc.)

// --- Power-Up Types ---
const POWER_UPS = [
  {
    type: 'bomb',
    label: '💣',
    description: 'Increase max bombs by 1',
    apply: player => { player.maxBombs = (player.maxBombs || 1) + 1; }
  },
  {
    type: 'flame',
    label: '🔥',
    description: 'Increase explosion range by 1',
    apply: player => { player.flame = (player.flame || 1) + 1; }
  },
  {
    type: 'speed',
    label: '⚡',
    description: 'Increase speed',
    apply: player => { player.speed = (player.speed || 1) + 1; }
  }
];

function App() {
  const [nickname, setNickname] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Please enter a nickname.');
      return;
    }
    setError('');
    setSubmitted(true);
  }

  // Simulated waiting room logic
  const [playerCount, setPlayerCount] = useState(1); // Start with 1 (yourself)
  const [timer, setTimer] = useState(null); // null means not started
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (!submitted) return;
    // Simulate other players joining every 1s up to 4
    if (playerCount < 4) {
      const joinInterval = setInterval(() => {
        setPlayerCount(c => Math.min(4, c + 1));
      }, 1000);
      return () => clearInterval(joinInterval);
    }
  }, [submitted, playerCount]);

  useEffect(() => {
    if (!submitted) return;
    // Start timer if 2+ players and timer not started
    if (playerCount >= 2 && timer === null) {
      setTimer('starting');
      setCountdown(2);
    }
  }, [playerCount, submitted, timer]);

  useEffect(() => {
    if (timer === 'starting' && countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer, countdown]);

  // Show game board when countdown reaches 0
  if (timer === 'starting' && countdown <= 0) {
    return jsx('div', { className: 'game-board-container' },
      jsx('h2', null, 'Game Board (static demo)'),
      jsx(GameBoard, { nickname })
    );
  }

  // Waiting room UI
  if (!submitted) {
    return jsx('div', { className: 'welcome' },
      jsx('h1', null, 'Bomberman DOM'),
      jsx('form', { onSubmit: handleSubmit, style: { display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '220px' } },
        jsx('label', { htmlFor: 'nickname' }, 'Enter your nickname:'),
        jsx('input', {
          id: 'nickname',
          type: 'text',
          value: nickname,
          onInput: e => setNickname(e.target.value),
          autoFocus: true,
          maxLength: 16,
          required: true,
          style: { padding: '0.5rem', fontSize: '1rem', borderRadius: '0.5rem', border: '1px solid #555', background: '#222', color: '#fff' }
        }),
        error && jsx('div', { style: { color: '#f55', fontSize: '0.9em' } }, error),
        jsx('button', { type: 'submit', style: { padding: '0.5rem', fontSize: '1rem', borderRadius: '0.5rem', background: '#4caf50', color: '#fff', border: 'none' } }, 'Join')
      )
    );
  }

  return jsx('div', { className: 'welcome' },
    jsx('h1', null, `Welcome, ${nickname}!`),
    jsx('p', null, `Players joined: ${playerCount} / 4`),
    playerCount < 2 && jsx('p', null, 'Waiting for more players...'),
    playerCount >= 2 && jsx('p', null, `Game starting in ${countdown} seconds...`),
    jsx('p', { style: { fontSize: '0.9em', color: '#aaa' } }, 'This is a simulation. Real multiplayer coming soon.')
  );
}

// --- Game Board Component ---
function GameBoard({ nickname }) {
  const cols = 13, rows = 11;
  // Generate static map: 0=empty, 1=wall, 2=block
  function createInitialMap() {
    const m = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        if (x === 0 || y === 0 || x === cols-1 || y === rows-1) row.push(1);
        else if (x % 2 === 0 && y % 2 === 0) row.push(1);
        else if ((x <= 1 && y <= 1) || (x >= cols-2 && y <= 1) || (x <= 1 && y >= rows-2) || (x >= cols-2 && y >= rows-2)) row.push(0);
        else row.push(Math.random() < 0.6 ? 2 : 0);
      }
      m.push(row);
    }
    // Ensure the two cells next to each player's spawn are always empty
    // Top-left player
    m[1][2] = 0; // right of [1,1]
    m[2][1] = 0; // below [1,1]
    // Top-right player
    m[1][cols-3] = 0; // left of [1,cols-2]
    m[2][cols-2] = 0; // below [1,cols-2]
    // Bottom-left player
    m[rows-3][1] = 0; // above [rows-2,1]
    m[rows-2][2] = 0; // right of [rows-2,1]
    // Bottom-right player
    m[rows-3][cols-2] = 0; // above [rows-2,cols-2]
    m[rows-2][cols-3] = 0; // left of [rows-2,cols-2]
    return m;
  }
  // Defensive map initialization: always ensure array
  const [map] = useState(createInitialMap());
  // Player state
  const [playerPos, setPlayerPos] = useState([1, 1]);
  // Track lives and alive state for all players
  const [playerLives, setPlayerLives] = useState(3);
  const [playerAlive, setPlayerAlive] = useState(true); // you
  // --- Add maxBombs state ---
  const [maxBombs, setMaxBombs] = useState(1); // Default 1
  // --- Add flame state for explosion range ---
  const [flame, setFlame] = useState(1); // Default explosion range 1
  // Track power-ups on the map: {y, x, type}
  const [powerUps, setPowerUps] = useState([]);
  const [otherPlayers, setOtherPlayers] = useState([
    { name: 'P2', color: '#0ff', pos: [1,cols-2], alive: true, lives: 3 },
    { name: 'P3', color: '#f0f', pos: [rows-2,1], alive: true, lives: 3 },
    { name: 'P4', color: '#0f0', pos: [rows-2,cols-2], alive: true, lives: 3 },
  ]);
  // Bomb state: array of { y, x, time } (time = Date.now() when placed)
  const [bombs, setBombs] = useState([]);
  // Explosion state: array of { y, x, time }
  const [explosions, setExplosions] = useState([]);
  // Map state for destructible blocks (mutable copy)
  const [gameMap, setGameMap] = useState(map.map(row => row.slice()));
  // Player alive/dead state
  const [alive, setAlive] = useState(true);
  // Block input if dead or game over
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  // Detect player death from explosion (now: lose a life, die if 0)
  const [hitExplosions, setHitExplosions] = useState(new Set());

  useEffect(() => {
  if (!playerAlive || gameOver) return;

  let gotHit = false;

  explosions.forEach(ex => {
    const explosionId = `${ex.y}-${ex.x}-${ex.time}`;
    const isOnPlayer = ex.y === playerPos[0] && ex.x === playerPos[1];

    if (isOnPlayer && !hitExplosions.has(explosionId)) {
      gotHit = true;
      setHitExplosions(new Set([...hitExplosions, explosionId]));
    }
  });

  if (gotHit) {
    if (playerLives > 1) {
      setPlayerLives(playerLives - 1);
    } else {
      setPlayerLives(0);
      setPlayerAlive(false);
    }
  }
}, [explosions, playerPos, playerAlive, gameOver, hitExplosions, playerLives]);



  // Handle keyboard movement and bomb drop
  useEffect(() => {
    if (!playerAlive || gameOver) return;
    function handleKey(e) {
      let [y, x] = playerPos;
      if (e.key === 'ArrowUp') y--;
      else if (e.key === 'ArrowDown') y++;
      else if (e.key === 'ArrowLeft') x--;
      else if (e.key === 'ArrowRight') x++;
      else if (e.key === ' ' || e.key === 'Spacebar') {
        // --- Use nickname for bomb owner ---
        const playerBombs = bombs.filter(b => b.owner === nickname).length;
        if (
          !bombs.some(b => b.y === playerPos[0] && b.x === playerPos[1]) &&
          (maxBombs === Infinity || playerBombs < maxBombs)
        ) {
          setBombs(bombs => [...bombs, { y: playerPos[0], x: playerPos[1], time: Date.now(), owner: nickname }]);
        }
        return;
      }
      if (gameMap[y] && gameMap[y][x] === 0) {
        // --- Check for power-up at new position ---
        const puIdx = powerUps.findIndex(p => p.y === y && p.x === x);
        if (puIdx !== -1) {
          const pu = powerUps[puIdx];
          // Remove power-up from map
          setPowerUps(pus => pus.filter((_, i) => i !== puIdx));
          // Apply power-up effect
          if (pu.type === 'bomb') {
            setMaxBombs(Infinity);
          } else if (pu.type === 'flame') {
            // Increase explosion range by 4
            setFlame(flame => flame + 4);
          } else if (pu.type === 'speed') {
            // Placeholder: could increase speed
            // setSpeed(speed => speed + 1);
          }
        }
        setPlayerPos([y, x]);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playerPos, gameMap, bombs, playerAlive, gameOver, maxBombs, powerUps, nickname]);

  // Bomb explosion logic
  useEffect(() => {
    if (bombs.length === 0) return;
    const now = Date.now();
    const timers = bombs.map(bomb => {
      const delay = Math.max(0, 2000 - (now - bomb.time));
      return setTimeout(() => {
        // Explosion logic
        const explosionCells = [[bomb.y, bomb.x]];
        // Directions: up, down, left, right
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (let [dy, dx] of dirs) {
          for (let i = 1; i <= flame; i++) { // Explosion range = flame
            const ny = bomb.y + dy*i, nx = bomb.x + dx*i;
            if (!gameMap[ny] || gameMap[ny][nx] === undefined) break;
            if (gameMap[ny][nx] === 1) break; // Wall blocks explosion
            explosionCells.push([ny, nx]);
            if (gameMap[ny][nx] === 2) break; // Stop at destructible block
          }
        }
        setExplosions(explosions => [...explosions, ...explosionCells.map(([y,x]) => ({ y, x, time: Date.now() }))]);
        // Remove destructible blocks and spawn power-ups
        setGameMap(gameMap => {
          const newMap = gameMap.map(row => row.slice());
          const newPowerUps = [];
          for (let [y, x] of explosionCells) {
            if (newMap[y][x] === 2) {
              newMap[y][x] = 0;
              // --- Randomly spawn a power-up ---
              if (Math.random() < 0.3) { // 30% chance
                const pu = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
                newPowerUps.push({ y, x, type: pu.type });
              }
            }
          }
          if (newPowerUps.length > 0) setPowerUps(pus => [...pus, ...newPowerUps]);
          return newMap;
        });
        // Check if you are hit (handled in explosion effect above)
        // Check if other players are hit (simulate random movement for demo)
        setOtherPlayers(players => players.map(p => {
          if (!p.alive) return p;
          // For demo: 10% chance to move randomly, else stay
          let pos = p.pos;
          if (Math.random() < 0.1) {
            const moves = [[0,1],[0,-1],[1,0],[-1,0]];
            for (let [dy,dx] of moves) {
              const ny = p.pos[0]+dy, nx = p.pos[1]+dx;
              if (gameMap[ny] && gameMap[ny][nx] === 0) {
                pos = [ny, nx];
                break;
              }
            }
          }
          if (explosionCells.some(([y, x]) => y === pos[0] && x === pos[1])) {
            if (p.lives > 1) {
              return { ...p, lives: p.lives - 1 };
            } else {
              return { ...p, lives: 0, alive: false };
            }
          }
          return { ...p, pos };
        }));
        setBombs(bombs => bombs.filter(b => b !== bomb));
      }, delay);
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [bombs, gameMap, playerPos, nickname, flame]);

  // Remove explosion visuals after 400ms
  useEffect(() => {
    if (explosions.length === 0) return;
    const now = Date.now();
    const timers = explosions.map(ex => {
      const delay = Math.max(0, 400 - (now - ex.time));
      return setTimeout(() => {
        setExplosions(explosions => explosions.filter(e => e !== ex));
      }, delay);
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [explosions]);

  // Win/lose logic
  useEffect(() => {
    const aliveOthers = otherPlayers.filter(p => p.alive).length;
    if ((!playerAlive || playerLives === 0) && !gameOver) {
      setGameOver(true);
      setWin(false);
    } else if (playerAlive && playerLives > 0 && aliveOthers === 0 && !gameOver) {
      setGameOver(true);
      setWin(true);
    }
  }, [playerAlive, playerLives, otherPlayers, gameOver]);

  // All players (for rendering)
  const players = [
    { name: nickname, color: '#ff0', pos: playerPos, alive: playerAlive, lives: playerLives },
    ...otherPlayers
  ];
  // Render grid
  return jsx('div', {
    className: 'bomberman-board'
  },
    gameOver && jsx('div', {
      className: 'game-overlay',
      style: { zIndex: 10 }
    },
      jsx('h1', null, win ? 'You Win!' : 'Game Over'),
      jsx('button', { onClick: () => window.location.reload(), style: { marginTop: '1rem', padding: '0.5rem 1.5rem', fontSize: '1.2rem', borderRadius: '0.5rem', background: '#333', color: '#fff', border: 'none' } }, 'Restart')
    ),
    jsx('div', { style: { marginBottom: '0.5rem', color: '#fff', fontWeight: 'bold' } }, `Lives: ${playerLives} | Bombs: ${maxBombs === Infinity ? '∞' : maxBombs} | Flame: ${flame}`),
    jsx('div', {
      className: 'bomberman-grid'
    },
      ...gameMap.reduce((acc, row, y) => acc.concat(row.map((cell, x) => {
        let content = null;
        if (cell === 1) content = jsx('div', { className: 'bomberman-wall' });
        else if (cell === 2) content = jsx('div', { className: 'bomberman-block' });
        // Bomb
        const bomb = bombs.find(b => b.y === y && b.x === x);
        if (bomb) {
          content = jsx('div', { className: 'bomberman-bomb' });
        }
        // Explosion
        const explosion = explosions.find(e => e.y === y && e.x === x);
        if (explosion) {
          content = jsx('div', { className: 'bomberman-explosion' });
        }
        // --- Render power-up if present ---
        const pu = powerUps.find(p => p.y === y && p.x === x);
        if (pu) {
          const puDef = POWER_UPS.find(p => p.type === pu.type);
          content = jsx('div', { className: 'bomberman-powerup' }, puDef ? puDef.label : '?');
        }
        // Player icon
        const player = players.find(p => p.pos[0] === y && p.pos[1] === x && p.alive);
        if (player) {
          console.log("Player:", player.name, "Nickname:", nickname, "Match:", player.name === nickname);
          content = jsx('div', {
            className: 'bomberman-player',
            style: { background: player.color }
          }, player.name === nickname ? 'You' : player.name);
        }
        return jsx('div', {
          key: `${y}-${x}`,
          className: 'bomberman-cell'
        }, content);
      })), [])
    )
  );
}
window.App = App;
document.addEventListener('DOMContentLoaded', () => {
    render();
});