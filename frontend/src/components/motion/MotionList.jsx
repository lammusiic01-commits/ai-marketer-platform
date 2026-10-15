import { Children } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

export default function MotionList({ children, className = '', itemClassName = '', stagger = 0.035 }) {
  const reduce = useReducedMotion()
  const items = Children.toArray(children)
  const variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : stagger } },
  }
  const itemVariants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 5 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 430, damping: 34 } },
  }
  return (
    <motion.div className={className} variants={variants} initial="hidden" animate="visible">
      {items.map((child, index) => (
        <motion.div className={itemClassName} variants={itemVariants} key={child.key ?? index}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
