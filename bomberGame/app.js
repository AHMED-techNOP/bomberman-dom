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

let init = null
let initMap = null

//  ------------------------------------------------------------------------------------------------
let hasNavigated = false
function App() {
  const { _, navigate } = useRouter()
  const [nickname, setNickname] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [messages, setMessages] = useState([])


  const [otherPlayers, setOtherPlayers] = useState([])

  const [gameMap, setGameMap] = useState(initMap?.map(row => row.slice()));

  function handleSubmit(e) {
    e.preventDefault();
    const input = e.target.elements.nickname;
    const nicknameValue = input.value.trim();
    if (nicknameValue.length === 0) {
      setError('Nickname cannot be empty');
      return;
    }
    setError('');
    setNickname(nicknameValue);
    setSubmitted(true);
    navigate("#/lobby")
  }

  function handelMessage(e) {
    if (e.key === 'Enter') {
      const text = e.target.value.trim()
      if (text) {
        sendChatMessage(text)
        e.target.value = ''
      }
    }
  }


  function handleSocketMessage(data) {

    if (data.type === 'join') {
      console.log(`${data.nickname} joined`)
    }

    if (data.type === 'init') {
      init = data
      initMap = data.map

      setOtherPlayers(data.allPlayers)
    }

    if (data.type === 'new-player') {
      setOtherPlayers(data.allPlayers)
    }

    if (data.type === 'chat') {
      const msg = `${data.nickname}: ${data.message}`
      setMessages(prev => [...prev, msg])
    }

    if (data.type === 'block-destroyed') {
      setGameMap(data.map)
    }

  }


  useEffect(() => {
    if (submitted) {
      connectWebSocket(nickname, handleSocketMessage)
    }
  }, [submitted])


  function showMsg(msg) {
    return jsx("div", null, `${msg}`)
  }



  // Simulated waiting room logic
  const [playerCount, setPlayerCount] = useState(1); // Start with 1 (yourself)
  const [timer, setTimer] = useState(null); // null means not started
  const [countdown, setCountdown] = useState(2);
  const [waitingTime, setWaitingTime] = useState(0)


  useEffect(() => {
    if (!submitted) return;

    const joinInterval = setInterval(() => {
      setPlayerCount(c => {
        if (c >= 4) {
          clearInterval(joinInterval);
          return c;
        }
        return c + 1;
      });
    }, 1000);

    return () => clearInterval(joinInterval);
  }, [submitted]); // ✅ no need for playerCount here

  // useEffect(() => {
  //   if (!submitted) return;
  //   // Start timer if 2+ players and timer not started
  //   if (playerCount >= 2 && timer === null) {
  //     setTimer('starting');
  //     setCountdown(2);
  //   }
  // }, [playerCount, submitted, timer]);

  useEffect(() => {
    if (submitted && waitingTime <= 20) {
      const t = setTimeout(() => setWaitingTime(c => c + 1), 1000)
      return () => clearTimeout(t);
    }

  }, [waitingTime, submitted])

  useEffect(() => {
    if (playerCount >= 2 && waitingTime === 20) {
      console.log(timer);

      setTimer('starting')
    }
    if (playerCount === 4) {
      setWaitingTime(20)
      setTimer('starting')
    }
  }, [waitingTime, playerCount]);

  useEffect(() => {
    if (timer === 'starting' && countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
    if (timer === 'starting' && countdown === 0 && !hasNavigated) {
      hasNavigated = true
      navigate('/gamePage');
    }
  }, [timer, countdown]);

  // Show game board when countdown reaches 0
  if (timer === 'starting' && countdown <= 0) {
    return jsx('div', null,
      jsx('div', { className: 'game-board-container' },
        jsx('h2', null, 'Game Board (static demo)'),
        jsx(GameBoard, { nickname, otherPlayers, gameMap, setGameMap })
      ),
      jsx('div', { id: 'chat-container' },
        jsx('div', { id: 'chat-messages' },
          ...messages.map(msg => showMsg(msg))
        ),
        jsx('input', { onkeydown: handelMessage, id: 'chat-input', placeholder: 'send message' }, '')
      )
    )
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

  if (waitingTime >= 20 && playerCount >= 2) {
    return jsx('div', null,
      jsx('div', { className: 'welcome' },
        jsx('h1', null, `Welcome, ${nickname}!`),
        jsx('p', null, `Players joined: ${playerCount} / 4`),
        playerCount < 2 && jsx('p', null, 'Waiting for more players...'),
        playerCount >= 2 && jsx('p', null, `Game starting in ${countdown} seconds...`),
        jsx('p', { style: { fontSize: '0.9em', color: '#aaa' } }, 'This is a simulation. Real multiplayer coming soon.')
      ),
      jsx('div', { id: 'chat-container' },
        jsx('div', { id: 'chat-messages' },
          ...messages.map(msg => showMsg(msg))
        ),
        jsx('input', { onkeydown: handelMessage, id: 'chat-input', placeholder: 'send message' }, '')
      )
    )

  } else {

    return jsx('div', null,
      jsx('div', { className: 'welcome' },
        jsx('h1', null, `Welcome, ${nickname}!`),
        jsx('p', null, `Players joined: ${playerCount} / 4`),

        // Waiting phase: less than 2 players
        playerCount < 2 && waitingTime < 20 &&
        jsx('p', null, `Waiting for more players... (${waitingTime}s left)`),

        // Timeout expired but still only 1 player
        playerCount < 2 && waitingTime === 0 &&
        jsx('p', null, 'Still waiting for more players... Restarting timer.'),

        // Enough players → countdown to game
        playerCount >= 2 && waitingTime < 20 &&
        jsx('p', null, `Game starting in ${waitingTime}s...`),

        // Optional: if waitingTime reaches 20 with 2+ players, start game in another useEffect

        jsx('p', { style: { fontSize: '0.9em', color: '#aaa' } },
          'This is a simulation. Real multiplayer coming soon.'
        )
      ),
      jsx('div', { id: 'chat-container' },
        jsx('div', { id: 'chat-messages' },
          ...messages.map(msg => showMsg(msg))
        ),
        jsx('input', { onkeydown: handelMessage, id: 'chat-input', placeholder: 'send message' }, '')
      )
    )

  }

}


//  ------------------------------------------------------------------------------------------------


// --- Game Board Component ---
function GameBoard({ nickname, otherPlayers, gameMap, setGameMap }) {

  console.log(otherPlayers);

  // const cols = 13, rows = 11

  // Player state
  const [playerPos, setPlayerPos] = useState(init.player.pos);
  // // Track lives and alive state for all players
  const [playerLives, setPlayerLives] = useState(init.player.lives);
  const [playerAlive, setPlayerAlive] = useState(true); // you
  // --- Add maxBombs state ---
  const [maxBombs, setMaxBombs] = useState(1); // Default 1
  // --- Add flame state for explosion range ---
  const [flame, setFlame] = useState(1); // Default explosion range 1
  // --- Add speed state for movement speed ---
  const [speed, setSpeed] = useState(1); // Default speed multiplier 1
  // --- Add pixel position state for smooth movement ---
  const cellSize = 32; // px
  const gap = 2; // px, matches CSS
  const [pixelPos, setPixelPos] = useState({ x: playerPos[1] * (cellSize + gap), y: playerPos[0] * (cellSize + gap) });
  // --- Add movement direction and moving state ---
  const [moveDir, setMoveDir] = useState(null); // 'up', 'down', 'left', 'right', or null
  const [moving, setMoving] = useState(false);
  // Track power-ups on the map: {y, x, type}
  const [powerUps, setPowerUps] = useState([]);

  // const [otherPlayers, setOtherPlayers] = useState([
  //   { name: 'P2', color: '#0ff', pos: [1, cols - 2], alive: true, lives: 3 },
  //   { name: 'P3', color: '#f0f', pos: [rows - 2, 1], alive: true, lives: 3 },
  //   { name: 'P4', color: '#0f0', pos: [rows - 2, cols - 2], alive: true, lives: 3 },
  // ]);
  // Bomb state: array of { y, x, time } (time = Date.now() when placed)
  const [bombs, setBombs] = useState([]);
  // Explosion state: array of { y, x, time }
  const [explosions, setExplosions] = useState([]);
  // Map state for destructible blocks (mutable copy)



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



  //  ------------------------------------------------------------------------------------------------




  // Handle keyboard movement and bomb drop
  useEffect(() => {
    if (!playerAlive || gameOver) return;
    function handleKey(e) {
      if (moving) return; // Ignore input while moving
      let dir = null;
      if (e.key === 'ArrowUp') dir = 'up';
      else if (e.key === 'ArrowDown') dir = 'down';
      else if (e.key === 'ArrowLeft') dir = 'left';
      else if (e.key === 'ArrowRight') dir = 'right';
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
      } else {
        return;
      }
      if (dir) {
        setMoveDir(dir);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playerPos, gameMap, bombs, playerAlive, gameOver, maxBombs, powerUps, nickname, moving]);


  //  ------------------------------------------------------------------------------------------------


  // Animate movement with requestAnimationFrame
  useEffect(() => {
    if (!moveDir || moving) return;
    let [y, x] = playerPos;
    let targetY = y, targetX = x;
    if (moveDir === 'up') targetY--;
    else if (moveDir === 'down') targetY++;
    else if (moveDir === 'left') targetX--;
    else if (moveDir === 'right') targetX++;
    // Check bounds and collision
    if (!(gameMap[targetY] && gameMap[targetY][targetX] === 0)) {
      setMoveDir(null);
      return;
    }
    setMoving(true);
    const start = { ...pixelPos };
    const end = {
      x: targetX * (cellSize + gap),
      y: targetY * (cellSize + gap)
    };
    const duration = 120 / speed; // ms, adjusted by speed multiplier
    const startTime = performance.now();
    function animate(now) {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      setPixelPos({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      });
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Snap to grid, update logical position
        setPlayerPos([targetY, targetX]);

        sendMove(targetY, targetX)

        // --- Check for power-up at new position ---
        const puIdx = powerUps.findIndex(p => p.y === targetY && p.x === targetX);
        if (puIdx !== -1) {
          const pu = powerUps[puIdx];
          // Remove power-up from map
          setPowerUps(pus => pus.filter((_, i) => i !== puIdx));
          // Apply power-up effect
          if (pu.type === 'bomb') {
            setMaxBombs(maxBombs => maxBombs + 1);
          } else if (pu.type === 'flame') {
            // Increase explosion range by 4
            setFlame(flame => flame + 1);
          } else if (pu.type === 'speed') {
            // Increase movement speed by 0.5
            setSpeed(speed => speed + 0.5);
          }
        }
        setMoving(false);
        setMoveDir(null);
      }
    }
    requestAnimationFrame(animate);
    // eslint-disable-next-line
  }, [moveDir]);


  //  ------------------------------------------------------------------------------------------------


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
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let [dy, dx] of dirs) {
          for (let i = 1; i <= flame; i++) { // Explosion range = flame
            const ny = bomb.y + dy * i, nx = bomb.x + dx * i;
            if (!gameMap[ny] || gameMap[ny][nx] === undefined) break;
            if (gameMap[ny][nx] === 1) break; // Wall blocks explosion
            explosionCells.push([ny, nx]);
            if (gameMap[ny][nx] === 2) break; // Stop at destructible block
          }
        }
        setExplosions(explosions => [...explosions, ...explosionCells.map(([y, x]) => ({ y, x, time: Date.now() }))]);
        // Remove destructible blocks and spawn power-ups
        setGameMap(gameMap => {
          const newMap = gameMap.map(row => row.slice());
          const newPowerUps = [];
          for (let [y, x] of explosionCells) {
            if (newMap[y][x] === 2) {
              sendDestroyedBlock(y, x)
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

        setBombs(bombs => bombs.filter(b => b !== bomb));
      }, delay);
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [bombs, gameMap, playerPos, nickname, flame]);


  //  ------------------------------------------------------------------------------------------------


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


  //  ------------------------------------------------------------------------------------------------


  // Win/lose logic
  useEffect(() => {
    // if (otherPlayers) {

    // }
    const aliveOthers = otherPlayers?.filter(p => p.alive).length;
    if ((!playerAlive || playerLives === 0) && !gameOver) {
      setGameOver(true);
      setWin(false);
    } else if (playerAlive && playerLives > 0 && aliveOthers === 1 && !gameOver) {
      setGameOver(true);
      setWin(true);
    }
  }, [playerAlive, playerLives, otherPlayers, gameOver]);

  //  ------------------------------------------------------------------------------------------------


  // All players (for rendering)

  const players = [
    {
      name: nickname,
      pos: playerPos,
      alive: playerAlive,
      lives: playerLives
    },
    ...(otherPlayers || []).map(p => ({
      name: p.nickname,
      pos: p.pos,
      alive: true,
      lives: p.lives
    }))
  ];

  const [playerImage, setPlayerImage] = useState('run-right');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setPlayerImage('run-left');
      }
      if (e.key === 'ArrowRight') {
        setPlayerImage('run-right');
      }
      if (e.key === 'ArrowDown') {
        setPlayerImage('run-down');
      }
      if (e.key === 'ArrowUp') {
        setPlayerImage('run-up');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyup => {
      if (handleKeyup.key === 'ArrowLeft' || handleKeyup.key === 'ArrowRight') {
        setPlayerImage('run-down'); // Default to down when not moving
      }
    })

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  //  ------------------------------------------------------------------------------------------------

  // Update pixel position when playerPos changes (snap to grid)
  useEffect(() => {
    setTimeout(() => {
      setPixelPos({ x: playerPos[1] * (cellSize + gap), y: playerPos[0] * (cellSize + gap) });
    }, 0);
  }, [playerPos]);
  // Render grid



  // ------------------------------------------------------------------------------------------------

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
    jsx('div', { style: { marginBottom: '0.5rem', color: '#fff', fontWeight: 'bold' } }, `Lives: ${playerLives} | Bombs: ${maxBombs === Infinity ? '∞' : maxBombs} | Flame: ${flame} | Speed: ${speed.toFixed(1)}x`),
    jsx('div', {
      className: 'bomberman-grid',

    },
      // --- Absolutely positioned player ---
      jsx('div', {
        className: 'bomberman-player-abs',
        style: {
          backgroundImage: `url("assets/${playerImage}.gif")`,
          transform: `translate(${pixelPos.x}px, ${pixelPos.y}px)`
        }
      },),
      // --- Render the rest of the grid as before ---
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
        // Player icon (for other players only)
        const player = players?.find(p => p.pos[0] === y && p.pos[1] === x && p.alive && p.name !== nickname);
        if (player) {
          content = jsx('div', {
            className: 'bomberman-player',
            style: {
              backgroundImage: `url("./assets/${playerImage}.gif")`
            }
          }, '');
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