// --- Game Board Component ---
function GameBoard({ nickname, serverMap, playerInfo, allPlayers, serverBombs, serverExplosions, serverMapChanges, setServerMapChanges, myLives, myAlive, indexPl }) {


  if (!serverMap || !playerInfo) {
    return jsx('div', { style: { color: '#fff', textAlign: 'center', padding: '2rem' } }, 'Loading game data...');
  }
  // Player state - initialize from server data
  const [playerPos, setPlayerPos] = useState(playerInfo.pos);

  // --- Add maxBombs state ---
  const [maxBombs, setMaxBombs] = useState(1); // Default 1

  const [flame, setFlame] = useState(1); // Default explosion range 1

  const [speed, setSpeed] = useState(1); // Default speed multiplier 1

  const cellSize = 32; // px
  const gap = 2; // px, matches CSS
  const [pixelPos, setPixelPos] = useState({ x: playerPos[1] * (cellSize + gap), y: playerPos[0] * (cellSize + gap) });

  const [moveDir, setMoveDir] = useState(null); // 'up', 'down', 'left', 'right', or null
  const [moving, setMoving] = useState(false);

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

  const [bombs, setBombs] = useState([]);

  const allBombs = [...bombs, ...serverBombs];

  const [explosions, setExplosions] = useState([]);

  const allExplosions = [...explosions, ...serverExplosions];

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


    setServerMapChanges([]);
  }, [serverMapChanges]);


  const [win, setWin] = useState(false);

  //  ------------------------------------------------------------------------------------------------


  // Handle keyboard movement and bomb drop
  useEffect(() => {
    if (!myAlive) return;
    function handleKey(e) {
      if (moving) return;
      let dir = null;
      if (e.key === 'ArrowUp') dir = 'up';
      else if (e.key === 'ArrowDown') dir = 'down';
      else if (e.key === 'ArrowLeft') dir = 'left';
      else if (e.key === 'ArrowRight') dir = 'right';
      else if (e.key === ' ' || e.key === 'Spacebar') {

        const playerBombs = bombs.filter(b => b.owner === nickname).length;
        if (
          !allBombs.some(b => b.y === playerPos[0] && b.x === playerPos[1]) &&
          (maxBombs === Infinity || playerBombs < maxBombs)
        ) {
          const bombTime = Date.now();
          setBombs(bombs => [...bombs, { y: playerPos[0], x: playerPos[1], time: bombTime, owner: nickname }]);
          
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
  }, [playerPos, gameMap, bombs, myAlive, maxBombs, powerUps, nickname, moving]);


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
       
        setPlayerPos([targetY, targetX]);
        
        sendMoveMessage([targetY, targetX]);
        
        const puIdx = powerUps.findIndex(p => p.y === targetY && p.x === targetX);
        if (puIdx !== -1) {
          const pu = powerUps[puIdx];
          
          setPowerUps(pus => pus.filter((_, i) => i !== puIdx));
          
          sendPowerUpCollectionMessage([targetY, targetX], pu.type);
         
          if (pu.type === 'bomb') {
            setMaxBombs(maxBombs => maxBombs + 1);
          } else if (pu.type === 'flame') {
            
            setFlame(flame => flame + 1);
          } else if (pu.type === 'speed') {
            
            setSpeed(speed => speed + 0.5);
          }
        }
        setMoving(false);
        setMoveDir(null);
      }
    }
    requestAnimationFrame(animate);
    
  }, [moveDir]);


  //  ------------------------------------------------------------------------------------------------


  // Bomb explosion logic
  useEffect(() => {
    if (allBombs.length === 0) return;
    const now = Date.now();
    const timers = bombs.map(bomb => {
      const delay = Math.max(0, 2000 - (now - bomb.time));
      return setTimeout(() => {
        
        const explosionCells = [[bomb.y, bomb.x]];
        // Directions: up, down, left, right
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (let [dy, dx] of dirs) {
          for (let i = 1; i <= flame; i++) { 
            const ny = bomb.y + dy * i, nx = bomb.x + dx * i;
            if (!gameMap[ny] || gameMap[ny][nx] === undefined) break;
            if (gameMap[ny][nx] === 1) break; 
            explosionCells.push([ny, nx]);
            if (gameMap[ny][nx] === 2) break; 
          }
        }
        const explosionTime = Date.now();
        setExplosions(explosions => [...explosions, ...explosionCells.map(([y, x]) => ({ y, x, time: explosionTime }))]);
      
        sendExplosionMessage(explosionCells, explosionTime);
        
        setGameMap(gameMap => {
          const newMap = gameMap.map(row => row.slice());
          const newPowerUps = [];
          const destroyedBlocks = [];
          for (let [y, x] of explosionCells) {
            if (newMap[y][x] === 2) {
              newMap[y][x] = 0;
              destroyedBlocks.push([y, x]);
              
              if (Math.random() < 0.3) { 
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
       
        setOtherPlayers(players => players.map(p => {
          if (!p.alive) return p;
       
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



  // All players (for rendering) - use server data
  const players = [
    { name: nickname, color: playerInfo.color, pos: playerPos, alive: myAlive, lives: myLives, i: indexPl },
    ...allPlayers.filter(p => p.nickname !== nickname).map(p => ({
      name: p.nickname,
      color: p.color,
      pos: p.pos,
      alive: p.alive !== undefined ? p.alive : true,
      lives: p.lives,
      i: p.i,
      img: p.img || `assets/P${p.i}/run-down.gif` // Default to run-down if no image provided
    }))
  ];


  const [playerImage, setPlayerImage] = useState('run-right');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        setPlayerImage('run-left');
        sendImg(indexPl, 'run-left', nickname)
      }
      if (e.key === 'ArrowRight') {
        setPlayerImage('run-right');
        sendImg(indexPl, 'run-right', nickname);
      }
      if (e.key === 'ArrowDown') {
        setPlayerImage('run-down');
        sendImg(indexPl, 'run-down', nickname);
      }
      if (e.key === 'ArrowUp') {
        setPlayerImage('run-up');
        sendImg(indexPl, 'run-up', nickname);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyup => {
      if (handleKeyup.key === 'ArrowLeft' || handleKeyup.key === 'ArrowRight') {
        setPlayerImage('run-down'); // Default to down when not moving
        sendImg(indexPl, 'run-down', nickname);
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




  // ------------------------------------------------------------------------------------------------



  // --- Heart animation state ---
  const [heartScale, setHeartScale] = useState(1);
  useEffect(() => {
    let frame;
    let start;
    function animate(now) {
      if (!start) start = now;
      const t = ((now - start) / 1000) % 1
      const scale = 1 + 0.15 * Math.sin(t * 2 * Math.PI);
      setHeartScale(scale);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);


  useEffect(() => {

    if (allPlayers.length === 1 && myAlive) {

      setWin(true);

    }

  }, [allPlayers]);


  if (win) {
    return jsx('div', {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.5s ease-in-out'
      }
    },
      // Win Box
      jsx('div', {
        style: {
          backgroundColor: '#2e8b57',
          color: 'white',
          padding: '40px 60px',
          borderRadius: '15px',
          textAlign: 'center',
          boxShadow: '0 0 30px rgba(0, 255, 0, 0.5)',
          animation: 'scaleIn 0.5s ease-in-out'
        }
      },
        jsx('div', { style: { fontSize: '3em', marginBottom: '20px' } }, '🏆'),
        jsx('div', { style: { fontSize: '2em', fontWeight: 'bold', marginBottom: '10px' } }, 'YOU WIN'),
        jsx('p', { style: { color: '#eee', fontSize: '1em', marginBottom: '30px' } }, 'Congratulations! You were the last player standing.'),
        jsx('button', {
          onClick: () => window.location.reload(),
          style: {
            padding: '10px 25px',
            fontSize: '1em',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#00cc66',
            color: 'white',
            transition: 'background 0.3s'
          },
          onMouseOver: (e) => e.target.style.backgroundColor = '#00994d',
          onMouseOut: (e) => e.target.style.backgroundColor = '#00cc66'
        }, '🔁 Play Again')
      )
    )
  }

  return jsx('div', {
    className: 'bomberman-board'
  },

    // --- Player stats bar at the top ---
    jsx('div', {
      className: 'player-stats-bar',
      style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2em', fontSize: '1.3em', marginBottom: '1.2em', background: 'rgba(30,30,30,0.95)', borderRadius: '0.7em', padding: '0.7em 0em', boxShadow: '0 2px 8px #0008', border: '2px solid #444' }
    },
      jsx('span', { style: { display: 'flex', alignItems: 'center', gap: '0.4em' } },
        jsx('span', {
          style: {
            display: 'inline-block',
            transform: `scale(${heartScale})`,
            transition: 'none',
            willChange: 'transform',
          }
        }, '❤️'),
        jsx('span', { style: { fontWeight: 'bold', color: '#f55' } }, myLives)
      ),
      jsx('span', { style: { display: 'flex', alignItems: 'center', gap: '0.4em' } }, '💣', jsx('span', { style: { fontWeight: 'bold', color: '#fff' } }, maxBombs === Infinity ? '∞' : maxBombs)),
      jsx('span', { style: { display: 'flex', alignItems: 'center', gap: '0.4em' } }, '🔥', jsx('span', { style: { fontWeight: 'bold', color: '#ff0' } }, flame)),
      jsx('span', { style: { display: 'flex', alignItems: 'center', gap: '0.4em' } }, '⚡', jsx('span', { style: { fontWeight: 'bold', color: '#0ff' } }, speed.toFixed(1) + 'x'))
    ),

    // --- Render the grid ---
    jsx('div', {
      className: 'bomberman-grid',

    },
    
      jsx('div', {
        className: 'bomberman-player-abs',
        style: {
          backgroundImage: `url("assets/P${indexPl}/${playerImage}.gif")`,
          transform: `translate(${pixelPos.x}px, ${pixelPos.y}px)`
        }
      },),

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
      
        const pu = powerUps.find(p => p.y === y && p.x === x);
        if (pu) {
          const puDef = POWER_UPS.find(p => p.type === pu.type);
          content = jsx('div', { className: 'bomberman-powerup' }, puDef ? puDef.label : '?');
        }
        
        const player = players.find(p => p.pos[0] === y && p.pos[1] === x && p.alive && p.name !== nickname);
        if (player) {
          console.log(`Rendering player ${player.name} at position [${y}, ${x}]`)
          content = jsx('div', {
            className: 'bomberman-player',
            style: {
              backgroundImage: player.img
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