export default function TypingIndicator({ names = [] }) {
  if (!names.length) return <div className="typing-indicator typing-placeholder" aria-hidden="true" />
  const label = names.length === 1 ? `${names[0]} печатает` : `${names.slice(0, 2).join(' и ')} печатают`
  return (
    <div className="typing-indicator" role="status" aria-live="polite">
      <span className="typing-dots"><i /><i /><i /></span>
      <span>{label}</span>
    </div>
  )
}
