import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, MoreHorizontal, Pencil, Reply, Trash2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { reactions } from './ReactionPicker'
import ReactionPicker from './ReactionPicker'
import LinkPreview from './LinkPreview'
import { initials } from '../../lib/utils'

const reactionGlyph = Object.fromEntries(reactions.map(item => [item.value, item.glyph]))

function timeLabel(value) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message, currentUserId, grouped = false, onReply, onEdit, onDelete, onReact }) {
  const safeMessage = message || {}
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(safeMessage.body || '')
  const [saving, setSaving] = useState(false)
  const own = Number(safeMessage.author_id) === Number(currentUserId)

  const saveEdit = async event => {
    event.preventDefault()
    const value = editBody.trim()
    if (!value) return
    setSaving(true)
    try {
      await onEdit?.(safeMessage.id, value)
      setEditing(false)
    } catch (error) {
      toast.error(error?.message || 'Не удалось изменить сообщение')
    } finally {
      setSaving(false)
    }
  }

  const chooseAction = action => {
    setMenuOpen(false)
    if (action === 'reply') onReply?.(safeMessage)
    if (action === 'edit') {
      setEditBody(safeMessage.body || '')
      setEditing(true)
    }
    if (action === 'delete') onDelete?.(safeMessage.id)
  }

  return (
    <article className={`message-row${own ? ' own' : ''}${grouped ? ' grouped' : ''}`}>
      {grouped ? <span className="message-avatar-spacer" /> : <span className="message-avatar">{safeMessage.author_avatar_url ? <img src={safeMessage.author_avatar_url} alt="" /> : initials(safeMessage.author_name || '')}</span>}
      <div className="message-stack">
        {!grouped && <div className="message-author-line"><b>{own ? 'Вы' : safeMessage.author_name || 'Пользователь'}</b><time>{safeMessage.created_at ? timeLabel(safeMessage.created_at) : '—'}</time>{safeMessage.edited_at && <small>изменено</small>}</div>}
        {safeMessage.reply && <div className="message-reply-quote"><b>{safeMessage.reply?.author_name || 'Пользователь'}</b><span>{safeMessage.reply?.body || ''}</span></div>}
        <div className="message-bubble">
          {safeMessage.deleted ? <div className="deleted-message">Сообщение удалено</div> : editing ? (
            <form className="message-edit-form" onSubmit={saveEdit}>
              <textarea autoFocus maxLength="10000" value={editBody} onChange={event => setEditBody(event.target.value)} aria-label="Редактировать сообщение" />
              <div><button type="button" className="icon-button tiny" onClick={() => setEditing(false)} aria-label="Отменить"><X size={14} /></button><button type="submit" className="icon-button tiny edit-save" disabled={saving || !editBody.trim()} aria-label="Сохранить"><Check size={14} /></button></div>
            </form>
          ) : (
            <>
              {safeMessage.body && <div className="message-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{safeMessage.body}</ReactMarkdown></div>}
              {!!safeMessage.attachments?.length && <div className="message-attachments">{safeMessage.attachments.map((attachment, index) => attachment?.type === 'image' ? (
                <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noopener noreferrer" className="message-image-link"><img src={attachment.thumbnail_url || attachment.url} alt={attachment.name} loading="lazy" /></a>
              ) : attachment.type === 'link' ? (
                <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noopener noreferrer" className="message-file-card"><FileText size={16} /><span>{attachment.name || attachment.url}</span></a>
              ) : (
                <a key={`${attachment.url}-${index}`} href={attachment.url} download={attachment.name} className="message-file-card"><FileText size={16} /><span><b>{attachment.name}</b><small>{Math.ceil((attachment.size || 0) / 1024)} КБ</small></span></a>
              ))}</div>}
              {safeMessage.body && <LinkPreview text={safeMessage.body} />}
            </>
          )}
          <time className="message-hover-time">{safeMessage.created_at ? timeLabel(safeMessage.created_at) : '—'}</time>
        </div>
        {!safeMessage.deleted && !editing && <div className="message-action-row">
          <ReactionPicker compact onPick={emoji => onReact?.(safeMessage.id, emoji)} />
          <button type="button" className="message-action-button" onClick={() => chooseAction('reply')} aria-label="Ответить"><Reply size={13} /></button>
          {own && <div className="message-menu-wrap"><button type="button" className="message-action-button" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-label="Действия с сообщением"><MoreHorizontal size={15} /></button>{menuOpen && <div className="message-context-menu"><button type="button" onClick={() => chooseAction('edit')}><Pencil size={13} />Изменить</button><button type="button" className="danger-action" onClick={() => chooseAction('delete')}><Trash2 size={13} />Удалить</button></div>}</div>}
        </div>}
        {!!safeMessage.reactions?.length && <div className="message-reactions">{safeMessage.reactions.map(reaction => <button type="button" key={reaction?.emoji || 'reaction'} className={reaction?.mine ? 'mine' : ''} onClick={() => onReact?.(safeMessage.id, reaction?.emoji)} aria-label={`Реакция ${reaction?.emoji || ''}, ${reaction?.count || 0}`}><span>{reactionGlyph[reaction?.emoji] || reaction?.emoji || '·'}</span><b>{reaction?.count || 0}</b></button>)}</div>}
      </div>
    </article>
  )
}
