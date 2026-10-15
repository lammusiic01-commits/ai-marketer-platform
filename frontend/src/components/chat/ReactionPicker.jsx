const reactions = [
  { value: ':thumbsup:', label: 'Нравится', glyph: '👍' },
  { value: ':heart:', label: 'Сердце', glyph: '❤️' },
  { value: ':joy:', label: 'Смех', glyph: '😂' },
  { value: ':open_mouth:', label: 'Удивление', glyph: '😮' },
  { value: ':sob:', label: 'Сочувствие', glyph: '😢' },
  { value: ':tada:', label: 'Поздравление', glyph: '🎉' },
]

export { reactions }

export default function ReactionPicker({ onPick, compact = false }) {
  return (
    <div className={`reaction-picker${compact ? ' compact' : ''}`} role="group" aria-label="Выбрать реакцию">
      {reactions.map(item => <button type="button" key={item.value} aria-label={item.label} title={item.label} onClick={() => onPick(item.value)}>{item.glyph}</button>)}
    </div>
  )
}
