import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, MoreHorizontal, Users } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../lib/api'
import { initials } from '../../lib/utils'
import { useChatStore } from '../../lib/chat'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import TypingIndicator from './TypingIndicator'

function chatTitle(chat, userId) {
  if (chat.type === 'project') return chat.name || 'Чат проекта'
  return chat.members?.find(member => member.id !== userId)?.name || 'Личный чат'
}

function formatDay(value) {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Сегодня'
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера'
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

export default function ChatWindow({ chat, userId, onBack }) {
  const queryClient = useQueryClient()
  const scrollRef = useRef(null)
  const lastMessageId = useRef(null)
  const firstLoad = useRef(true)
  const oldScrollHeight = useRef(0)
  const typingSentAt = useRef(0)
  const [nearBottom, setNearBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const [replyTo, setReplyTo] = useState(null)
  const connected = useChatStore(state => state.connected)
  const typingIds = useChatStore(state => state.typingByConversation[chat.id] || [])
  const typingNames = useMemo(() => typingIds.filter(id => Number(id) !== Number(userId)).map(id => chat.members?.find(member => Number(member.id) === Number(id))?.name).filter(Boolean), [typingIds, chat.members, userId])

  const messagesQuery = useInfiniteQuery({
    queryKey: ['chat-messages', chat.id],
    queryFn: async ({ pageParam }) => {
      const params = { limit: 50 }
      if (pageParam) params.before = pageParam
      return (await api.get(`/chats/${chat.id}/messages`, { params })).data
    },
    initialPageParam: null,
    getPreviousPageParam: firstPage => firstPage?.length === 50 ? firstPage[0]?.id : undefined,
    staleTime: 5000,
  })
  const messages = useMemo(() => messagesQuery.data?.pages.flat() || [], [messagesQuery.data])

  useEffect(() => {
    firstLoad.current = true
    lastMessageId.current = null
    setNearBottom(true)
    setNewCount(0)
    setReplyTo(null)
  }, [chat.id])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element || !messages.length) return
    const newest = messages[messages.length - 1]
    if (firstLoad.current) {
      element.scrollTop = element.scrollHeight
      firstLoad.current = false
      lastMessageId.current = newest.id
      return
    }
    if (newest.id !== lastMessageId.current) {
      const isOwn = Number(newest.author_id) === Number(userId)
      if (nearBottom || isOwn) {
        element.scrollTop = element.scrollHeight
        setNearBottom(true)
        setNewCount(0)
      } else {
        setNewCount(value => value + 1)
      }
      lastMessageId.current = newest.id
    } else if (oldScrollHeight.current) {
      element.scrollTop += element.scrollHeight - oldScrollHeight.current
      oldScrollHeight.current = 0
    }
  }, [messages, nearBottom, userId])

  useEffect(() => {
    if (!messages.length) return
    api.post(`/chats/${chat.id}/read`).then(() => queryClient.invalidateQueries({ queryKey: ['chats'] })).catch(() => {})
  }, [chat.id, messages.length, queryClient])

  const handleScroll = async event => {
    const element = event.currentTarget
    setNearBottom(element.scrollHeight - element.scrollTop - element.clientHeight < 90)
    if (element.scrollTop < 60 && messagesQuery.hasPreviousPage && !messagesQuery.isFetchingPreviousPage) {
      oldScrollHeight.current = element.scrollHeight
      await messagesQuery.fetchPreviousPage()
    }
  }

  const sendMessage = async (body, files) => {
    try {
      const attachments = []
      for (const file of files) {
        const form = new FormData()
        form.append('file', file)
        const { data } = await api.post('/chats/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        attachments.push(data)
      }
      await api.post(`/chats/${chat.id}/messages`, { body, attachments, reply_to_id: replyTo?.id || null })
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', chat.id] })
      await queryClient.invalidateQueries({ queryKey: ['chats'] })
      return true
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Не удалось отправить сообщение')
      return false
    }
  }

  const editMessage = async (messageId, body) => {
    const { data } = await api.patch(`/messages/${messageId}`, { body })
    queryClient.setQueryData(['chat-messages', chat.id], current => current ? {
      ...current,
      pages: current.pages.map(page => page.map(item => item.id === messageId ? data : item)),
    } : current)
    return data
  }

  const deleteMessage = async messageId => {
    try {
      await api.delete(`/messages/${messageId}`)
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', chat.id] })
      await queryClient.invalidateQueries({ queryKey: ['chats'] })
      toast.success('Сообщение удалено')
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Не удалось удалить сообщение')
    }
  }

  const react = async (messageId, emoji) => {
    try {
      const { data } = await api.post(`/messages/${messageId}/reactions`, { emoji })
      queryClient.setQueryData(['chat-messages', chat.id], current => current ? {
        ...current,
        pages: current.pages.map(page => page.map(item => item.id === messageId ? { ...item, reactions: data } : item)),
      } : current)
    } catch (error) {
      toast.error(error?.response?.data?.detail || 'Не удалось поставить реакцию')
    }
  }

  const sendTyping = () => {
    const now = Date.now()
    if (now - typingSentAt.current < 1800) return
    typingSentAt.current = now
    useChatStore.getState().send({ type: 'typing', conversation_id: chat.id })
  }

  const title = chatTitle(chat, userId)
  let previous = null
  return (
    <section className="chat-window">
      <header className="chat-window-header">
        <button type="button" className="icon-button chat-back-button" onClick={onBack} aria-label="К списку чатов"><ArrowLeft size={17} /></button>
        <span className={`chat-avatar header-avatar${chat.type === 'project' ? ' project' : ''}`}>{chat.type === 'project' ? <Users size={17} /> : initials(title)}</span>
        <span className="chat-window-title"><b>{title}</b><small>{chat.type === 'project' ? `${chat.members?.length || 0} участников · чат проекта` : 'Личные сообщения'}</small></span>
        <span className={`connection-state${connected ? ' connected' : ''}`}><i />{connected ? 'В сети' : 'Подключение'}</span>
        <button type="button" className="icon-button" aria-label="Действия чата" title="Действия чата"><MoreHorizontal size={18} /></button>
      </header>
      <div className="chat-message-scroll scrollbar" ref={scrollRef} onScroll={handleScroll}>
        {messagesQuery.isFetchingPreviousPage && <div className="older-messages-loading"><span className="skeleton-shape" />Загружаем ранние сообщения</div>}
        {messagesQuery.isLoading ? <div className="message-loading"><span className="skeleton-shape skeleton-heading" /><span className="skeleton-shape skeleton-copy" /><span className="skeleton-shape skeleton-wide" /></div> : messages.length ? messages.map((message, index) => {
          const dayKey = new Date(message.created_at).toDateString()
          const previousDayKey = previous ? new Date(previous.created_at).toDateString() : null
          const separator = dayKey !== previousDayKey
          const grouped = Boolean(previous && previous.author_id === message.author_id && dayKey === previousDayKey && new Date(message.created_at) - new Date(previous.created_at) < 5 * 60 * 1000)
          previous = message
          return <div key={message.id}>{separator && <div className="chat-day-separator"><span>{formatDay(message.created_at)}</span></div>}<MessageBubble message={message} currentUserId={userId} grouped={grouped} onReply={setReplyTo} onEdit={editMessage} onDelete={deleteMessage} onReact={react} /></div>
        }) : <div className="chat-empty-start"><span className="empty-icon"><Users size={20} /></span><b>Начните разговор</b><p>Сообщения и файлы останутся в этом чате.</p></div>}
        <TypingIndicator names={typingNames} />
        {newCount > 0 && <button type="button" className="new-messages-pill" onClick={() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; setNearBottom(true); setNewCount(0) }}><ArrowDown size={14} />{newCount} новых ниже</button>}
      </div>
      <MessageComposer onSend={sendMessage} onTyping={sendTyping} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
    </section>
  )
}
