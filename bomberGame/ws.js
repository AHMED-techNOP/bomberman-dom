let socket
let nickname = null

function connectWebSocket(name, onMessage) {
    nickname = name
    socket = new WebSocket('/')

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', nickname }))
    }

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        onMessage(data)
    }
}



function sendChatMessage(text) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'chat', nickname: nickname, message: text }))
    }
}

function sendClosing(nickname) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'closing', nickname }))
    }
}

function sendStarting() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'starting' }))
    }
}

function sendMoveMessage(pos) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'move', nickname: nickname, pos: pos }))
    }
}

function sendBombMessage(pos, time) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'place-bomb', nickname: nickname, pos: pos, time: time }))
    }
}
function sendImg(i, playerImage, nickname) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'IMG', i , playerImage, nickname }))
    }
}

function sendExplosionMessage(explosionCells, time) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'explosion', nickname: nickname, explosionCells: explosionCells, time: time }))
    }
}

function sendBlockDestructionMessage(destroyedBlocks, newPowerUps) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'destroy-blocks', nickname: nickname, destroyedBlocks: destroyedBlocks, newPowerUps: newPowerUps }))
    }
}

function sendPowerUpCollectionMessage(pos, powerUpType) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'collect-powerup', nickname: nickname, pos: pos, powerUpType: powerUpType }))
    }
}
