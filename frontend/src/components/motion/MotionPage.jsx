import { motion, useReducedMotion } from 'framer-motion'

export default function MotionPage({ children, className = '' }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={`motion-page ${className}`.trim()}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -4 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.72 }}
    >
      {children}
    </motion.div>
  )
}
