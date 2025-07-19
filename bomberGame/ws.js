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


function handleSocketMessage(data) {

    if (data.type === 'join') {
        console.log(`${data.nickname} joined`)
    }

    if (data.type === 'chat' && data.nickname !== nickname) {
        addChatMessage(data.nickname, data.message)
    }

}


const chatMessages = document.getElementById('chat-messages')
const chatInput = document.getElementById('chat-input')

function addChatMessage(nick, msg) {
    const div = document.createElement('div')
    div.textContent = `${nick}: ${msg}`
    chatMessages.appendChild(div)
    chatMessages.scrollTop = chatMessages.scrollHeight
}

function sendChatMessage(text) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'chat', nickname: nickname, message: text }))
    }
}

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const text = chatInput.value.trim()
        if (text) {
            sendChatMessage(text)
            addChatMessage(nickname, text)
            chatInput.value = ''
        }
    }
})
