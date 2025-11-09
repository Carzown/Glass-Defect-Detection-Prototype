import Constants from 'expo-constants'
import { io, Socket } from 'socket.io-client'

const extra = (Constants.expoConfig?.extra || {}) as Record<string, string>
const BACKEND_URL = extra.BACKEND_URL || 'http://localhost:5000'

let socket: Socket | null = null

export function connectDashboardSocket() {
  if (socket) return socket
  socket = io(BACKEND_URL, { transports: ['websocket'] })
  socket.emit('client:hello', { role: 'dashboard' })
  return socket
}

export function disconnectSocket() {
  try { socket?.disconnect() } catch {}
  socket = null
}

export function getSocket() { return socket }

export const socketConfig = { BACKEND_URL }
