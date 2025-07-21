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

let i = null
//  ------------------------------------------------------------------------------------------------
let hasNavigated = false
function App() {
  const { _, navigate } = useRouter()
  const [nickname, setNickname] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('')

  const [messages, setMessages] = useState([])

  const [serverMap, setServerMap] = useState(null)
  const [playerInfo, setPlayerInfo] = useState(null)
  const [allPlayers, setAllPlayers] = useState([])
  const [serverBombs, setServerBombs] = useState([])
  const [serverExplosions, setServerExplosions] = useState([])
  const [serverMapChanges, setServerMapChanges] = useState([])
  const [myLives, setMyLives] = useState(3); // default 3, will be set on init
  const [myAlive, setMyAlive] = useState(true); // default true, will be set on init

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

  const [waiting, setWaiting] = useState(false)


  function handleSocketMessage(data) {

    if (data.type === 'join') {
      console.log(`${data.nickname} joined`)
    }

    if (data.type === 'chat') {
      const msg = `${data.nickname}: ${data.message}`
      setMessages(prev => [...prev, msg])
    }

    if (data.type === 'starting') {
      console.log('Game is starting...')
      setWaiting(true)
    }

    if (data.type === 'error') {
      console.error(`Error from server: ${data.message}`);
      setError(data.message)
      setSubmitted(false)
      setNickname('')
      setWaiting(false)
    }



    if (data.type === 'init') {
      console.log('Received game initialization from server')
      i = data.player.i
      console.log('Player index:', i);

      // Store the server-provided map and player data
      setServerMap(data.map)
      setPlayerInfo(data.player)
      setAllPlayers(data.allPlayers)
      setMyLives(data.player.lives)
      setMyAlive(true); // player is alive at start
      // Start the game immediately
      setTimer('starting')
      setCountdown(0)
    }

    if (data.type === 'new-player') {
      console.log(`New player joined: ${data.player.nickname}`)
      console.log('New player data:', data.player)
      setAllPlayers(prev => {
        const newAllPlayers = [...prev, data.player]
        console.log('Updated allPlayers:', newAllPlayers)
        return newAllPlayers
      })
    }

    if (data.type === 'player-moved') {
      console.log(`Player ${data.nickname} moved to position [${data.pos[0]}, ${data.pos[1]}]`)
      setAllPlayers(prev => prev.map(p =>
        p.nickname === data.nickname
          ? { ...p, pos: data.pos }
          : p
      ))
    }

    if (data.type === 'player-left') {
      setAllPlayers(prev => prev.filter(p => p.nickname !== data.nickname));
      console.log(`Player ${data.nickname} left the game. Remaining players: ${prev.length - 1}`);
      if (data.nickname === nickname) {
        setMyAlive(false);
        setMyLives(0);
        console.log(`You (${nickname}) have left the game.`);
        // Optionally navigate to a different page or show a message
        navigate("#/lobby");
      }
      console.log(`Updated allPlayers after ${data.nickname} left:`, prev);
      return;
    }

    if (data.type === 'bomb-placed') {
      console.log(`Player ${data.nickname} placed a bomb at [${data.pos[0]}, ${data.pos[1]}]`)
      setServerBombs(prev => [...prev, {
        y: data.pos[0],
        x: data.pos[1],
        time: data.time,
        owner: data.nickname
      }])

      // Remove bomb after 2 seconds
      setTimeout(() => {
        setServerBombs(prev => prev.filter(b =>
          !(b.y === data.pos[0] && b.x === data.pos[1] && b.time === data.time)
        ))
      }, 2010)
    }

    if (data.type === 'explosion-effect') {
      console.log(`Player ${data.nickname} caused explosion at ${data.explosionCells.length} cells`)
      // Add explosion cells to server explosions
      const explosionTime = data.time;
      const newExplosions = data.explosionCells.map(([y, x]) => ({ y, x, time: explosionTime }));
      setServerExplosions(prev => [...prev, ...newExplosions]);

      // Remove explosions after 400ms
      setTimeout(() => {
        setServerExplosions(prev => prev.filter(e => e.time !== explosionTime));
      }, 400);
    }

    if (data.type === 'blocks-destroyed') {
      console.log(`Player ${data.nickname} destroyed ${data.destroyedBlocks.length} blocks`)
      // Add map changes to server state
      setServerMapChanges(prev => [...prev, {
        destroyedBlocks: data.destroyedBlocks,
        newPowerUps: data.newPowerUps
      }]);
    }

    if (data.type === 'powerup-collected') {
      console.log(`Player ${data.nickname} collected power-up at [${data.pos[0]}, ${data.pos[1]}]`)
      // Remove power-up from all players' screens
      setServerMapChanges(prev => [...prev, {
        removePowerUp: data.pos
      }]);
    }

    if (data.type === 'players-hit') {
      setAllPlayers(prev =>
        prev.map(p => {
          const hit = data.hitPlayers.find(hp => hp.nickname === p.nickname);
          return hit ? { ...p, lives: hit.lives, alive: hit.alive } : p;
        })
      );
      // Also update your own lives and alive if you are hit
      const me = data.hitPlayers.find(hp => hp.nickname === nickname);
      if (me) {
        setMyLives(me.lives);
        setMyAlive(me.alive);
      }
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


  const [countDown, setConuntDown] = useState(10)


  if (allPlayers.length >= 2) {

    setTimeout(() => {
      sendStarting()
    }, 20000)

  }



  useEffect(() => {
    if (waiting || allPlayers.length === 4) {
      let id = setInterval(() => {
        setConuntDown(prev => {
          if (prev === 0) {
            clearInterval(id)
            setWaiting(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

  }, [waiting, allPlayers])


  // Show waiting room while connecting to server
  if (submitted && (!waiting || countDown > 0)) {
    return jsx('div', null,
      jsx('div', { className: 'welcome' },
        jsx('h1', null, `Welcome, ${nickname}!`),
        jsx('p', null, 'Connecting to server...'),
        jsx('p', null, `${allPlayers.length} player${allPlayers.length === 1 ? "" : "s"} `),
        jsx('p', { style: { fontSize: '0.9em', color: '#aaa' } }, 'Waiting for game initialization...'),
        (waiting || allPlayers.length === 4) && jsx('p', null, `${countDown} /s`),

      ),
      jsx('div', { id: 'chat-container' },
        jsx('div', { id: 'chat-messages' },
          ...messages.map(msg => showMsg(msg))
        ),
        jsx('input', { onkeydown: handelMessage, id: 'chat-input', placeholder: 'send message' }, '')
      )
    )
  }

  // Show game board when server data is available
  if (serverMap && (waiting || allPlayers.length === 4)) {
    return jsx('div', null,
      jsx('div', { className: 'game-board-container' },
        jsx('h2', null, 'Bomberman Game'),
        jsx(GameBoard, { nickname, serverMap, playerInfo, allPlayers, serverBombs, serverExplosions, serverMapChanges, setServerMapChanges, myLives, myAlive })
      ),
      // jsx('div', { id: 'chat-container' },
      //   jsx('div', { id: 'chat-messages' },
      //     ...messages.map(msg => showMsg(msg))
      //   ),
      //   jsx('input', { onkeydown: handelMessage, id: 'chat-input', placeholder: 'send message' }, '')
      // )
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

}


//  ------------------------------------------------------------------------------------------------


// --- Game Board Component ---
function GameBoard({ nickname, serverMap, playerInfo, allPlayers, serverBombs, serverExplosions, serverMapChanges, setServerMapChanges, myLives, myAlive }) {
  const cols = 13, rows = 11;
  console.log(i);

  // Wait for server data before rendering
  if (!serverMap || !playerInfo) {
    return jsx('div', { style: { color: '#fff', textAlign: 'center', padding: '2rem' } }, 'Loading game data...');
  }
  // Player state - initialize from server data
  const [playerPos, setPlayerPos] = useState(playerInfo.pos);
  // Track lives and alive state for all players
  // const [playerLives, setPlayerLives] = useState(myLives);
  // const [playerAlive, setPlayerAlive] = useState(myAlive); // you
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
  const [otherPlayers, setOtherPlayers] = useState(
    allPlayers.filter(p => p.nickname !== nickname)
  );

  // Update otherPlayers when allPlayers changes
  useEffect(() => {
    console.log('allPlayers changed:', allPlayers)
    console.log('Current nickname:', nickname)
    const filtered = allPlayers.filter(p => p.nickname !== nickname)
    console.log('Filtered otherPlayers:', filtered)
    setTimeout(() => {
      setOtherPlayers(filtered);
    }, 0);
  }, [allPlayers, nickname]);
  // Bomb state: array of { y, x, time } (time = Date.now() when placed)
  const [bombs, setBombs] = useState([]);

  // Combine local bombs with server bombs
  const allBombs = [...bombs, ...serverBombs];
  // Explosion state: array of { y, x, time }
  const [explosions, setExplosions] = useState([]);

  // Combine local explosions with server explosions
  const allExplosions = [...explosions, ...serverExplosions];
  // Map state for destructible blocks (mutable copy)
  const [gameMap, setGameMap] = useState(serverMap.map(row => row.slice()));

  // Apply server map changes
  useEffect(() => {
    if (serverMapChanges.length === 0) return;

    setGameMap(currentMap => {
      const newMap = currentMap.map(row => row.slice());

      serverMapChanges.forEach(change => {
        // Remove destroyed blocks
        if (change.destroyedBlocks) {
          change.destroyedBlocks.forEach(([y, x]) => {
            if (newMap[y] && newMap[y][x] === 2) {
              newMap[y][x] = 0;
            }
          });
        }
      });

      return newMap;
    });

    // Handle power-ups from server changes
    serverMapChanges.forEach(change => {
      if (change.newPowerUps && change.newPowerUps.length > 0) {
        setPowerUps(prev => [...prev, ...change.newPowerUps]);
      }
      if (change.removePowerUp) {
        setPowerUps(prev => prev.filter(p =>
          !(p.y === change.removePowerUp[0] && p.x === change.removePowerUp[1])
        ));
      }
    });

    // Clear processed changes
    setServerMapChanges([]);
  }, [serverMapChanges]);

  // Block input if dead or game over
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  // Detect player death from explosion (now: lose a life, die if 0)
  const [hitExplosions, setHitExplosions] = useState(new Set());


  //  ------------------------------------------------------------------------------------------------


  // Handle keyboard movement and bomb drop
  useEffect(() => {
    if (!myAlive || gameOver) return;
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
          !allBombs.some(b => b.y === playerPos[0] && b.x === playerPos[1]) &&
          (maxBombs === Infinity || playerBombs < maxBombs)
        ) {
          const bombTime = Date.now();
          setBombs(bombs => [...bombs, { y: playerPos[0], x: playerPos[1], time: bombTime, owner: nickname }]);
          // Send bomb placement to server
          sendBombMessage([playerPos[0], playerPos[1]], bombTime);
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
  }, [playerPos, gameMap, bombs, myAlive, gameOver, maxBombs, powerUps, nickname, moving]);


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
        // Send movement to server
        sendMoveMessage([targetY, targetX]);
        // --- Check for power-up at new position ---
        const puIdx = powerUps.findIndex(p => p.y === targetY && p.x === targetX);
        if (puIdx !== -1) {
          const pu = powerUps[puIdx];
          // Remove power-up from map
          setPowerUps(pus => pus.filter((_, i) => i !== puIdx));
          // Send power-up collection to server
          sendPowerUpCollectionMessage([targetY, targetX], pu.type);
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
    if (allBombs.length === 0) return;
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
        const explosionTime = Date.now();
        setExplosions(explosions => [...explosions, ...explosionCells.map(([y, x]) => ({ y, x, time: explosionTime }))]);
        // Send explosion to server
        sendExplosionMessage(explosionCells, explosionTime);
        // Remove destructible blocks and spawn power-ups
        setGameMap(gameMap => {
          const newMap = gameMap.map(row => row.slice());
          const newPowerUps = [];
          const destroyedBlocks = [];
          for (let [y, x] of explosionCells) {
            if (newMap[y][x] === 2) {
              newMap[y][x] = 0;
              destroyedBlocks.push([y, x]);
              // --- Randomly spawn a power-up ---
              if (Math.random() < 0.3) { // 30% chance
                const pu = POWER_UPS[Math.floor(Math.random() * POWER_UPS.length)];
                newPowerUps.push({ y, x, type: pu.type });
              }
            }
          }
          if (newPowerUps.length > 0) setPowerUps(pus => [...pus, ...newPowerUps]);

          // Send block destruction to server
          if (destroyedBlocks.length > 0) {
            sendBlockDestructionMessage(destroyedBlocks, newPowerUps);
          }

          return newMap;
        });
        // Check if you are hit (handled in explosion effect above)
        // Check if other players are hit (simulate random movement for demo)
        setOtherPlayers(players => players.map(p => {
          if (!p.alive) return p;
          // For demo: 10% chance to move randomly, else stay
          let pos = p.pos;
          if (Math.random() < 0.1) {
            const moves = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (let [dy, dx] of moves) {
              const ny = p.pos[0] + dy, nx = p.pos[1] + dx;
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


  //  ------------------------------------------------------------------------------------------------


  // Remove explosion visuals after 400ms
  useEffect(() => {
    if (allExplosions.length === 0) return;
    const now = Date.now();
    const timers = allExplosions.map(ex => {
      const delay = Math.max(0, 400 - (now - ex.time));
      return setTimeout(() => {
        setExplosions(explosions => explosions.filter(e => e !== ex));
      }, delay);
    });
    return () => timers.forEach(t => clearTimeout(t));
  }, [allExplosions]);

  // Remove bombs after 2 seconds
  // useEffect(() => {
  //   if (allBombs.length === 0) return;
  //   const now = Date.now();
  //   const timers = allBombs.map(bomb => {
  //     const delay = Math.max(0, 2010 - (now - bomb.time));
  //     return setTimeout(() => {
  //       setBombs(bombs => bombs.filter(b => b !== bomb));
  //     }, delay);
  //   });
  //   return () => timers.forEach(t => clearTimeout(t));
  // }, [allBombs]);


  //  ------------------------------------------------------------------------------------------------


  // Win/lose logic
  // Comment out the win/lose logic useEffect
  /*
  useEffect(() => {
    // Only check win/lose if there are at least 2 players
    if (allPlayers.length < 2) return;

    const aliveOthers = otherPlayers.filter(p => p.alive).length;
    if ((!myAlive || myLives === 0) && !gameOver) {
      setGameOver(true);
      setWin(false);
    } else if (myAlive && myLives > 0 && aliveOthers === 0 && !gameOver) {
      setGameOver(true);
      setWin(true);
    }
  }, [myAlive, myLives, otherPlayers, gameOver, allPlayers.length]);
  */

  //  ------------------------------------------------------------------------------------------------


  // All players (for rendering) - use server data
  const players = [
    { name: nickname, color: playerInfo.color, pos: playerPos, alive: myAlive, lives: myLives },
    ...allPlayers.filter(p => p.nickname !== nickname).map(p => ({
      name: p.nickname,
      color: p.color,
      pos: p.pos,
      alive: p.alive !== undefined ? p.alive : true,
      lives: p.lives
    }))
  ];

  console.log('Rendering players:', players)

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
    jsx('div', { style: { marginBottom: '0.5rem', color: '#fff', fontWeight: 'bold' } }, `Lives: ${myLives} | Bombs: ${maxBombs === Infinity ? '∞' : maxBombs} | Flame: ${flame} | Speed: ${speed.toFixed(1)}x`),
    jsx('div', {
      className: 'bomberman-grid',

    },
      // --- Absolutely positioned player ---
      jsx('div', {
        className: 'bomberman-player-abs',
        style: {
          backgroundImage: `url("assets/P${i}/${playerImage}.gif")`,
          transform: `translate(${pixelPos.x}px, ${pixelPos.y}px)`
        }
      },),
      // --- Render the rest of the grid as before ---
      ...gameMap.reduce((acc, row, y) => acc.concat(row.map((cell, x) => {
        let content = null;
        if (cell === 1) content = jsx('div', { className: 'bomberman-wall' });
        else if (cell === 2) content = jsx('div', { className: 'bomberman-block' });
        // Bomb
        const bomb = allBombs.find(b => b.y === y && b.x === x);
        if (bomb) {
          content = jsx('div', { className: 'bomberman-bomb' });
        }
        // Explosion
        const explosion = allExplosions.find(e => e.y === y && e.x === x);
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
        const player = players.find(p => p.pos[0] === y && p.pos[1] === x && p.alive && p.name !== nickname);
        if (player) {
          console.log(`Rendering player ${player.name} at position [${y}, ${x}]`)
          content = jsx('div', {
            className: 'bomberman-player',
            style: {
              background: player.color,
              backgroundImage: player.name === nickname
                ? `url("./assets/${i}${playerImage}.gif")`
                : 'none'
            }
          }, player.name);
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