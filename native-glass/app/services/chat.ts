import AsyncStorage from '@react-native-async-storage/async-storage'

export type Message = {
  id: string
  sender: string
  text: string
  ts: number
}

const STORAGE_KEY = 'chat_messages'

let messages: Message[] = []
const listeners: Array<(msgs: Message[]) => void> = []

async function load() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) messages = JSON.parse(raw)
  } catch (e) {
    // ignore
  }
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch (e) {
    // ignore
  }
}

function notify() {
  const snapshot = messages.slice()
  listeners.forEach((l) => l(snapshot))
}

export function getMessages() {
  return messages.slice()
}

export function subscribe(cb: (msgs: Message[]) => void) {
  listeners.push(cb)
  cb(messages.slice())
  return () => {
    const idx = listeners.indexOf(cb)
    if (idx >= 0) listeners.splice(idx, 1)
  }
}

export async function sendMessage(sender: string, text: string) {
  if (!text || !text.trim()) return
  const msg: Message = { id: String(Date.now()) + Math.random().toString(36).slice(2,8), sender, text: text.trim(), ts: Date.now() }
  messages.push(msg)
  await persist()
  notify()
}

// initialize
load().then(() => notify())

export default { getMessages, subscribe, sendMessage }
