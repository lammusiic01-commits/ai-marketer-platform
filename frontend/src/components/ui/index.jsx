import { motion, useReducedMotion } from 'framer-motion'
import MotionButton from '../motion/MotionButton'
import MotionCard from '../motion/MotionCard'

export function Button({ children, variant = 'primary', size = '', loading = false, className = '', ...props }) {
  const buttonClass = `btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`.trim()
  return (
    <MotionButton className={buttonClass} disabled={loading || props.disabled} aria-busy={loading || undefined} {...props}>
      {loading && <span className="button-loading-shimmer" aria-hidden="true" />}
      {children}
    </MotionButton>
  )
}

export function Card({ children, className = '', ...props }) {
  return <MotionCard className={className} {...props}>{children}</MotionCard>
}

export function Field({ label, hint, error, children }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}{error && <small className="error-text">{error}</small>}</label>
}

export function Badge({ children, tone = 'muted' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function EmptyState({ icon: Icon, title, body, action }) {
  const reduce = useReducedMotion()
  return (
    <motion.div className="empty-state" initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
      <span className="empty-illustration" aria-hidden="true">
        <i className="empty-orbit empty-orbit-one" />
        <i className="empty-orbit empty-orbit-two" />
        {Icon && <span className="empty-icon"><Icon size={21} strokeWidth={1.6} /></span>}
      </span>
      <strong>{title}</strong>
      <p>{body}</p>
      {action}
    </motion.div>
  )
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice notice-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>
}

export function Spinner({ label = 'Загружаем данные…' }) {
  return (
    <div className="loading-skeleton" role="status" aria-label={label} aria-live="polite">
      <span className="skeleton-shape skeleton-heading" />
      <span className="skeleton-shape skeleton-copy" />
      <span className="skeleton-shape skeleton-wide" />
      <span className="skeleton-shape skeleton-wide" />
    </div>
  )
}
