import { motion, useReducedMotion } from 'framer-motion'

export default function MotionCard({ children, className = '', ...props }) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      className={`card ${className}`.trim()}
      whileHover={reduce ? undefined : { y: -1, scale: 1.003 }}
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
      {...props}
    >
      {children}
    </motion.section>
  )
}
