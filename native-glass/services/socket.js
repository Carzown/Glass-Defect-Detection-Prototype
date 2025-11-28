import io from 'socket.io-client'
import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || {})
const BACKEND_URL = extra.BACKEND_URL

let socket = null

export function connectSocket(path = '/') {
  if (!BACKEND_URL) return null
  if (!socket) {
    socket = io(BACKEND_URL, { path })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) socket.disconnect()
  socket = null
}
