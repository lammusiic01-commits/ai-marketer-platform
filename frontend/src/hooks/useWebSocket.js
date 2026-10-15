import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChatStore } from '../lib/chat'

export default function useWebSocket() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const token = localStorage.getItem('amp_token')
    if (!token) return undefined
    useChatStore.getState().connect(token, event => {
      if (event.type === 'new_message' && event.conversation_id) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', Number(event.conversation_id)] })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      } else if (event.type === 'message_edited' && event.message?.conversation_id) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', Number(event.message.conversation_id)] })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      } else if (event.type === 'message_deleted' && event.conversation_id) {
        queryClient.invalidateQueries({ queryKey: ['chat-messages', Number(event.conversation_id)] })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      }
    })
    return () => useChatStore.getState().disconnect()
  }, [queryClient])
}
