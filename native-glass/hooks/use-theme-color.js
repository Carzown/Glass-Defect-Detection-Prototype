import Constants from 'expo-constants'

const extra = (Constants.expoConfig?.extra || {})
const THEME = extra.THEME || 'light'

export default function useThemeColor() {
  return THEME
}
