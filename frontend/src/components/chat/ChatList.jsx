import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquarePlus, Search, Users } from 'lucide-react'
import MotionList from '../motion/MotionList'
import { initials } from '../../lib/utils'

function chatName(chat, userId) {
  if (chat.type === 'project') return chat.name || 'Чат проекта'
  return chat.members?.find(member => member.id !== userId)?.name || 'Личный чат'
}

function previewText(chat) {
  const last = chat.last_message
  if (!last) return 'Начните беседу'
  if (last.has_attachments && !last.body) return 'Вложение'
  return last.body || 'Вложение'
}

function messageTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function ChatRow({ chat, userId, active, onSelect }) {
  const name = chatName(chat, userId)
  const peer = chat.members?.find(member => member.id !== userId)
  return (
    <button type="button" className={`chat-list-row${active ? ' active' : ''}`} onClick={() => onSelect(chat.id)} aria-current={active ? 'page' : undefined}>
      <span className={`chat-avatar${chat.type === 'project' ? ' project' : ''}`}>
        {chat.type === 'project' ? <Users size={17} /> : peer?.avatar_url ? <img src={peer.avatar_url} alt="" /> : initials(name)}
        {chat.unread_count > 0 && <i className="chat-avatar-unread" />}
      </span>
      <span className="chat-row-copy">
        <span className="chat-row-title"><b>{name}</b><time>{messageTime(chat.last_message?.created_at)}</time></span>
        <span className="chat-row-preview">{previewText(chat)}</span>
      </span>
      {chat.unread_count > 0 && <span className="chat-unread-count">{chat.unread_count > 99 ? '99+' : chat.unread_count}</span>}
    </button>
  )
}

export default function ChatList({ chats = [], userId, activeChatId, onSelect, search, onSearch }) {
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ru-RU')
    return chats.filter(chat => !term || `${chatName(chat, userId)} ${previewText(chat)}`.toLocaleLowerCase('ru-RU').includes(term))
  }, [chats, search, userId])
  const direct = filtered.filter(chat => chat.type === 'direct')
  const projects = filtered.filter(chat => chat.type === 'project')
  const renderGroup = (title, items) => (
    <section className="chat-list-section" aria-label={title}>
      <div className="chat-list-section-head"><span>{title}</span><b>{items.length}</b></div>
      {items.length ? <MotionList className="chat-list-items" stagger={0.025}>
        {items.map(chat => <ChatRow key={chat.id} chat={chat} userId={userId} active={Number(activeChatId) === Number(chat.id)} onSelect={onSelect} />)}
      </MotionList> : <p className="chat-list-empty">{search ? 'Совпадений нет' : 'Пока нет бесед'}</p>}
    </section>
  )

  return (
    <aside className="chat-list-panel">
      <div className="chat-list-header">
        <div><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Сообщения</h1></div>
        <Link to="/app/team" className="icon-button" aria-label="Написать участнику" title="Начать беседу"><MessageSquarePlus size={17} /></Link>
      </div>
      <label className="chat-search"><Search size={15} /><input value={search} onChange={event => onSearch(event.target.value)} placeholder="Поиск по чатам" aria-label="Поиск по чатам" /></label>
      <div className="chat-list-scroll scrollbar">
        {renderGroup('ЛИЧНЫЕ СООБЩЕНИЯ', direct)}
        {renderGroup('ЧАТЫ ПРОЕКТОВ', projects)}
        {!filtered.length && search && <p className="chat-list-no-results">Чатов по запросу не найдено.</p>}
      </div>
    </aside>
  )
}
