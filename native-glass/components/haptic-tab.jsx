import React from 'react'
import { TouchableOpacity, Text } from 'react-native'

export default function HapticTab({ children, ...props }) {
  return (
    <TouchableOpacity {...props}>
      <Text>{children}</Text>
    </TouchableOpacity>
  )
}
