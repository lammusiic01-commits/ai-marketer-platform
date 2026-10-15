import { motion, useReducedMotion } from 'framer-motion'

export default function MotionButton({ children, className = '', ...props }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      className={className}
      whileHover={reduce || props.disabled ? undefined : { y: -1 }}
      whileTap={reduce || props.disabled ? undefined : { scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 560, damping: 32, mass: 0.55 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
