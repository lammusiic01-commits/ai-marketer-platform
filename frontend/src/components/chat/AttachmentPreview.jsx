import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

export default function AttachmentPreview({ files, onRemove }) {
  const [previews, setPreviews] = useState([])
  useEffect(() => {
    const entries = files.map(file => ({ file, url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null }))
    setPreviews(entries)
    return () => entries.forEach(entry => entry.url && URL.revokeObjectURL(entry.url))
  }, [files])
  if (!files.length) return null
  return (
    <div className="attachment-preview-list" aria-label="Вложения перед отправкой">
      {previews.map(({ file, url }, index) => (
        <div className="attachment-preview-item" key={`${file.name}-${file.lastModified}-${index}`}>
          {url ? <img src={url} alt={`Предпросмотр: ${file.name}`} /> : <span className="attachment-file-icon"><FileText size={17} /></span>}
          <span className="attachment-preview-copy"><b>{file.name}</b><small>{formatSize(file.size)}</small></span>
          <button type="button" className="icon-button tiny" onClick={() => onRemove(index)} aria-label={`Убрать ${file.name}`}><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
