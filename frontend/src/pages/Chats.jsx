import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MessageSquare, Users } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { getUser } from '../lib/auth'
import useWebSocket from '../hooks/useWebSocket'
import ChatList from '../components/chat/ChatList'
import ChatWindow from '../components/chat/ChatWindow'
import ErrorBoundary from '../components/ErrorBoundary'
import { Notice, Spinner } from '../components/ui'

export default function Chats() {
  useWebSocket()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const handledProjectId = useRef(null)
  const user = getUser()
  const userId = user?.id
  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: async () => (await api.get('/chats')).data,
    staleTime: 5000,
  })
  const chats = chatsQuery.data || []
  const urlChatId = searchParams.get('conversationId')
  const projectIdParam = searchParams.get('projectId')
  const [activeChatId, setActiveChatId] = useState(urlChatId || null)

  useEffect(() => {
    if (projectIdParam) {
      if (handledProjectId.current === projectIdParam) return
      const existing = chats.find(chat => chat.type === 'project' && Number(chat.project_id) === Number(projectIdParam))
      if (existing) {
        handledProjectId.current = projectIdParam
        setActiveChatId(String(existing.id))
        setSearchParams({ conversationId: String(existing.id) }, { replace: true })
        return
      }
      handledProjectId.current = projectIdParam
      setActiveChatId(null)
      api.get(`/chats/project/${projectIdParam}`).then(({ data }) => {
        setActiveChatId(String(data.id))
        setSearchParams({ conversationId: String(data.id) }, { replace: true })
        queryClient.invalidateQueries({ queryKey: ['chats'] })
      }).catch(() => {})
      return
    }
    handledProjectId.current = null
    if (urlChatId) setActiveChatId(urlChatId)
    else if (!activeChatId && chats.length) setActiveChatId(String(chats[0].id))
  }, [urlChatId, projectIdParam, activeChatId, chats, queryClient, setSearchParams])

  const selectChat = id => {
    setActiveChatId(String(id))
    setSearchParams({ conversationId: String(id) })
  }

  const goBack = () => {
    setActiveChatId(null)
    setSearchParams({})
  }

  const activeChat = chats.find(chat => Number(chat.id) === Number(activeChatId))
  if (chatsQuery.isLoading) return <div className="chat-page-loading"><Spinner label="Загружаем чаты…" /></div>
  if (chatsQuery.isError) return <div className="page-stack"><Notice tone="danger">Не удалось загрузить чаты. Проверьте подключение и обновите страницу.</Notice></div>

  return (
    <div className={`chat-page${activeChat ? ' has-active-chat' : ''}`}>
      <ChatList chats={chats} userId={userId} activeChatId={activeChatId} onSelect={selectChat} search={search} onSearch={setSearch} />
      {activeChat ? <ErrorBoundary key={activeChat.id}><ChatWindow chat={activeChat} userId={userId} onBack={goBack} /></ErrorBoundary> : chats.length ? (
        <div className="chat-welcome"><span className="chat-welcome-mark"><MessageSquare size={22} /></span><h2>Выберите беседу</h2><p>Личные сообщения и обсуждения проектов — в одном рабочем потоке.</p></div>
      ) : (
        <div className="chat-welcome"><span className="chat-welcome-mark"><Users size={22} /></span><h2>Начните с команды</h2><p>Откройте участника в разделе «Команда» и нажмите «Написать» или перейдите в чат проекта.</p><Link to="/app/team" className="btn btn-secondary btn-small">Открыть команду</Link></div>
      )}
    </div>
  )
}
