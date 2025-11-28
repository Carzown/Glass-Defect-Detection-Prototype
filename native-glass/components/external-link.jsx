import React from 'react'
import { Linking, Text, TouchableOpacity } from 'react-native'

export default function ExternalLink({ href, children }) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL(href)}>
      <Text>{children}</Text>
    </TouchableOpacity>
  )
}
