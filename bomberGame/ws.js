let socket
let nickname = null

function connectWebSocket(name, onMessage) {
    nickname = name
    socket = new WebSocket('ws://localhost:3000')

    socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', nickname }))
    }

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        onMessage(data)
    }
}

function sendMove(y, x) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'move',
            pos: [y, x],
            nickname
        }));
    }
}

function sendChatMessage(text) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'chat', nickname: nickname, message: text }))
    }
}

function sendDestroyedBlock(y, x) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const message = {
            type: 'block-destroyed',
            position: { y, x }
        }
        socket.send(JSON.stringify(message));
    }
}

function sendBomb(y, x) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const message = {
            type: 'bomb',
            position: { y, x },
            nickname
        }
        socket.send(JSON.stringify(message));
    }
}