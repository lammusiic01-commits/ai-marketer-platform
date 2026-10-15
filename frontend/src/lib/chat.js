import { create } from 'zustand'

let reconnectTimer = null
let activeToken = ''
let activeHandler = null
let shouldReconnect = false
let heartbeatTimer = null
const typingTimers = new Map()

function socketUrl(token) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/chats?token=${encodeURIComponent(token)}`
}

export const useChatStore = create((set, get) => ({
  socket: null,
  connected: false,
  typingByConversation: {},

  connect(token, onEvent) {
    const current = get().socket
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) return current
    activeToken = token
    activeHandler = onEvent
    shouldReconnect = true
    const socket = new WebSocket(socketUrl(token))
    set({ socket, connected: false })
    socket.onopen = () => {
      set(state => state.socket === socket ? { connected: true } : state)
      clearInterval(heartbeatTimer)
      heartbeatTimer = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'heartbeat' }))
      }, 25000)
    }
    socket.onmessage = message => {
      let event
      try {
        event = JSON.parse(message.data)
      } catch {
        return
      }
      if (event.type === 'typing' && event.conversation_id) {
        const key = Number(event.conversation_id)
        const userId = Number(event.user_id)
        set(state => {
          const currentIds = state.typingByConversation[key] || []
          return { typingByConversation: { ...state.typingByConversation, [key]: currentIds.includes(userId) ? currentIds : [...currentIds, userId] } }
        })
        const timerKey = `${key}:${userId}`
        clearTimeout(typingTimers.get(timerKey))
        typingTimers.set(timerKey, setTimeout(() => {
          set(state => {
            const ids = (state.typingByConversation[key] || []).filter(id => id !== userId)
            const next = { ...state.typingByConversation }
            if (ids.length) next[key] = ids
            else delete next[key]
            return { typingByConversation: next }
          })
          typingTimers.delete(timerKey)
        }, 3600))
      }
      activeHandler?.(event)
    }
    socket.onerror = () => socket.close()
    socket.onclose = () => {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
      set(state => state.socket === socket ? { socket: null, connected: false } : state)
      if (shouldReconnect && activeToken) {
        clearTimeout(reconnectTimer)
        reconnectTimer = setTimeout(() => get().connect(activeToken, activeHandler), 1400)
      }
    }
    return socket
  },

  send(event) {
    const socket = get().socket
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(event))
    return true
  },

  disconnect() {
    shouldReconnect = false
    activeToken = ''
    activeHandler = null
    clearTimeout(reconnectTimer)
    reconnectTimer = null
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    for (const timer of typingTimers.values()) clearTimeout(timer)
    typingTimers.clear()
    const socket = get().socket
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, 'chat view closed')
    set({ socket: null, connected: false, typingByConversation: {} })
  },
}))
