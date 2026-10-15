import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Paperclip, Send, Smile } from 'lucide-react'
import AttachmentPreview from './AttachmentPreview'
import { toast } from 'sonner'

const MAX_BYTES = 20 * 1024 * 1024
const quickEmoji = ['👍', '❤️', '😂', '😮', '😢', '🎉']

function validFile(file) {
  return file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/')
}

export default function MessageComposer({ onSend, onTyping, busy = false, replyTo, onCancelReply }) {
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const textareaRef = useRef(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [body])

  const addFiles = incoming => {
    const accepted = []
    for (const file of Array.from(incoming || [])) {
      if (!validFile(file)) {
        toast.error('Разрешены изображения, PDF и текстовые файлы')
        continue
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: максимальный размер файла — 20 МБ`)
        continue
      }
      accepted.push(file)
    }
    setFiles(current => [...current, ...accepted].slice(0, 10))
  }

  const submit = async () => {
    const text = body.trim()
    if ((!text && files.length === 0) || busy) return
    const sent = await onSend(text, files)
    if (sent) {
      setBody('')
      setFiles([])
      onCancelReply?.()
      setEmojiOpen(false)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    }
  }

  const onKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const onPaste = event => {
    const pasted = Array.from(event.clipboardData?.items || [])
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean)
    if (pasted.length) addFiles(pasted)
  }

  const onDrop = event => {
    event.preventDefault()
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const insertEmoji = emoji => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? body.length
    const end = textarea?.selectionEnd ?? body.length
    const next = `${body.slice(0, start)}${emoji}${body.slice(end)}`
    setBody(next)
    setEmojiOpen(false)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  return (
    <div className={`composer-wrap${dragging ? ' is-dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={event => { if (event.currentTarget === event.target) setDragging(false) }} onDrop={onDrop}>
      {replyTo && <div className="reply-banner"><span><b>Ответ {replyTo.author_name}</b><small>{replyTo.body || 'Вложение'}</small></span><button type="button" className="icon-button tiny" onClick={onCancelReply} aria-label="Отменить ответ">×</button></div>}
      <AttachmentPreview files={files} onRemove={index => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} />
      <div className="composer-box">
        {dragging && <div className="composer-drop-hint">Отпустите файлы, чтобы прикрепить</div>}
        <textarea ref={textareaRef} rows="1" value={body} onChange={event => { setBody(event.target.value); onTyping?.() }} onKeyDown={onKeyDown} onPaste={onPaste} maxLength="10000" placeholder="Напишите сообщение…" aria-label="Текст сообщения" />
        <div className="composer-toolbar">
          <div className="composer-tools">
            <button type="button" className="icon-button tiny" title="Прикрепить файл" aria-label="Прикрепить файл" onClick={() => fileRef.current?.click()}><Paperclip size={16} /></button>
            <button type="button" className="icon-button tiny" title="Прикрепить изображение" aria-label="Прикрепить изображение" onClick={() => imageRef.current?.click()}><ImagePlus size={16} /></button>
            <div className="composer-emoji-wrap"><button type="button" className={`icon-button tiny${emojiOpen ? ' active' : ''}`} title="Вставить реакцию в текст" aria-label="Вставить эмодзи" onClick={() => setEmojiOpen(value => !value)}><Smile size={16} /></button>{emojiOpen && <div className="composer-emoji-popover">{quickEmoji.map(emoji => <button type="button" key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}</div>
            <span className="composer-hint">Enter — отправить · Shift+Enter — новая строка</span>
          </div>
          <button type="button" className="composer-send" onClick={submit} disabled={busy || (!body.trim() && !files.length)} aria-label="Отправить сообщение">{busy ? <span className="button-loading-shimmer" /> : <Send size={16} />}</button>
        </div>
        <input ref={fileRef} className="visually-hidden" type="file" multiple accept="image/*,application/pdf,text/*" onChange={event => { addFiles(event.target.files); event.target.value = '' }} />
        <input ref={imageRef} className="visually-hidden" type="file" multiple accept="image/*" onChange={event => { addFiles(event.target.files); event.target.value = '' }} />
      </div>
    </div>
  )
}
