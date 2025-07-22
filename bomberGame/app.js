


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

let indexPl = null
let waitingStart = false


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
     
      setError(data.message)
      setSubmitted(false)
      setNickname('')
      setWaiting(false)
    }



    if (data.type === 'init') {
     
      indexPl = data.player.i


      // Store the server-provided map and player data
      setServerMap(data.map)
      setPlayerInfo(data.player)
      setAllPlayers(data.allPlayers)
      setMyLives(data.player.lives)
      setMyAlive(true); // player is alive at start

    }


    if (data.type === 'IMG') {
      setAllPlayers(data.allPlayers)
    }


    if (data.type === 'new-player') {
      
      setAllPlayers(prev => {
        const newAllPlayers = [...prev, data.player]
       
        return newAllPlayers
      })
    }

    if (data.type === 'player-moved') {
     
      setAllPlayers(prev => prev.map(p =>
        p.nickname === data.nickname
          ? { ...p, pos: data.pos }
          : p
      ))
    }

    if (data.type === 'player-left') {
      setAllPlayers(prev => prev.filter(p => p.nickname !== data.nickname));
    
      if (data.nickname === nickname) {
        setMyAlive(false);
        setMyLives(0);
        navigate("#/lobby");
      }
   
      return;
    }

    if (data.type === 'bomb-placed') {

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

    if (!waitingStart) {
      setTimeout(() => {
        waitingStart = true
        sendStarting()
      }, 20000)
    }

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


  useEffect(() => {

    if (!myAlive) {
      sendClosing(nickname)
    }

  }, [myAlive]);


  const [colseChat, setColseChat] = useState(false)


  // Show waiting room while connecting to server
  if (submitted && (!waiting || countDown > 0)) {
    return jsx('div', { className: 'welcome-container' },
      jsx('div', { className: 'welcome' },
        jsx('h1', null, `Welcome, ${nickname}!`),
        jsx('p', { className: 'player-count' }, `${allPlayers.length} player${allPlayers.length === 1 ? "" : "s"}`),
        jsx('p', { className: 'waiting-msg' }, 'Waiting for game initialization...'),
        (waiting || allPlayers.length === 4) && jsx('p', { className: 'countdown' }, `${countDown} s`)
      ),

      colseChat && jsx('div', { id: 'chat-container' },
        jsx('button', { onClick: () => setColseChat(false), style: { position: 'fixed', top: '10px', right: '10px' } }, 'Close Chat'),
        jsx('div', { id: 'chat-messages' },
          ...messages.map(msg => showMsg(msg))
        ),
        jsx('input', { onkeydown: handelMessage, id: 'chat-input', placeholder: 'send message' }, '')
      ),
      jsx('button', {
        onClick: () => setColseChat(true),
        style: {
         display:  colseChat ? 'none' : 'block',
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '10px 15px',
          fontSize: '1em',
          borderRadius: '8px',
          backgroundColor: '#4caf50',
          color: 'white',
          border: 'none',
          cursor: 'pointer'
        }
      }, colseChat ? 'Close Chat' : 'Open Chat')
    )

  }

  // Show game board when server data is available
  if (serverMap && (waiting || allPlayers.length === 4)) {
    return jsx('div', null,
      jsx('div', { className: 'game-board-container' },
        jsx('h2', null, 'Bomberman Game'),
        jsx(GameBoard, { nickname, serverMap, playerInfo, allPlayers, serverBombs, serverExplosions, serverMapChanges, setServerMapChanges, myLives, myAlive, indexPl })
      ), !myAlive && jsx('div', {
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
        // Box
        jsx('div', {
          style: {
            backgroundColor: '#1e1e1e',
            color: 'white',
            padding: '40px 60px',
            borderRadius: '15px',
            textAlign: 'center',
            boxShadow: '0 0 30px rgba(255, 0, 0, 0.5)',
            animation: 'scaleIn 0.5s ease-in-out'
          }
        },
          jsx('div', { style: { fontSize: '3em', marginBottom: '20px' } }, '💀'),
          jsx('div', { style: { fontSize: '2em', fontWeight: 'bold', marginBottom: '10px' } }, 'YOU LOSE'),
          jsx('p', { style: { color: '#bbb', fontSize: '1em', marginBottom: '30px' } }, 'Better luck next time!'),
          jsx('button', {
            onClick: () => window.location.reload(), 
            style: {
              padding: '10px 25px',
              fontSize: '1em',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: '#ff4444',
              color: 'white',
              transition: 'background 0.3s'
            },
            onMouseOver: (e) => e.target.style.backgroundColor = '#cc0000',
            onMouseOut: (e) => e.target.style.backgroundColor = '#ff4444'
          }, '🔁 Play Again')
        )
      ),
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



window.App = App;
document.addEventListener('DOMContentLoaded', () => {
  render();
});