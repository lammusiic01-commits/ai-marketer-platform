import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CalendarDays, GripVertical, Plus } from 'lucide-react'
import { Badge } from '../ui'
import MotionList from '../motion/MotionList'
import { prettyDate } from '../../lib/utils'

const columns = [['backlog', 'В очереди'], ['in_progress', 'В работе'], ['review', 'На проверке'], ['done', 'Готово']]

function TaskCard({ task, onClick }) {
  const reduce = useReducedMotion()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: task.id })
  return <motion.article
    ref={setNodeRef}
    style={{ x: transform?.x ?? 0, y: transform?.y ?? 0, scaleX: transform?.scaleX ?? 1, scaleY: transform?.scaleY ?? 1, zIndex: isDragging ? 20 : undefined, position: 'relative', touchAction: 'pan-y' }}
    animate={reduce ? undefined : isDragging ? { scale: 1.05, rotate: -1.1, boxShadow: '0 18px 36px rgba(0,0,0,.45)' } : { scale: 1, rotate: 0, boxShadow: '0 0px 0px rgba(0,0,0,0)' }}
    transition={{ type: 'spring', stiffness: isDragging ? 360 : 520, damping: isDragging ? 24 : 36, mass: 0.65 }}
    className={`task-card priority-${task.priority}${isDragging ? ' is-dragging' : ''}`}
    tabIndex={0}
    aria-label={`Задача: ${task.title}. Нажмите Enter, чтобы открыть.`}
    onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick?.() } }}
    onClick={onClick}
  >
    <div className="task-card-line"><span className="task-labels">{(task.labels || []).map(label => <Badge key={label}>{label}</Badge>)}</span><button type="button" className="drag-handle" aria-label="Перетащить задачу" {...attributes} {...listeners} onClick={event => event.stopPropagation()}><GripVertical size={15} /></button></div>
    <strong>{task.title}</strong>{task.description && <p>{task.description}</p>}
    <div className="task-card-foot">{task.due_date && <span className="task-date"><CalendarDays size={13} />{prettyDate(task.due_date)}</span>}<span className="task-priority">{({ urgent: 'Срочно', high: 'Высокий', normal: 'Обычный', low: 'Низкий' })[task.priority] || 'Обычный'}</span><span className="task-avatar">{task.assignee_name?.[0] || 'М'}</span></div>
  </motion.article>
}

function ColumnDropZone({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={`column-cards${isOver ? ' is-over' : ''}`}>{children}</div>
}

export default function Board({ tasks = [], onMove, onCreate, onOpen }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const byStatus = useMemo(() => Object.fromEntries(columns.map(([key]) => [key, tasks.filter(task => task.status === key)])), [tasks])
  const dragEnd = event => {
    const { active, over } = event
    if (!over) return
    let status = columns.find(([key]) => key === String(over.id))?.[0]
    if (!status) status = columns.find(([key]) => byStatus[key].some(task => String(task.id) === String(over.id)))?.[0]
    const task = tasks.find(item => String(item.id) === String(active.id))
    if (task && status && task.status !== status) onMove?.(task, status)
  }

  return <DndContext sensors={sensors} onDragEnd={dragEnd}>
    <div className="kanban-board">{columns.map(([key, label]) => <section className="kanban-column" key={key}>
      <div className="column-head"><div><span className={`column-dot ${key}`} /><b>{label}</b><span className="column-count">{byStatus[key].length}</span></div><button type="button" className="icon-button tiny" onClick={() => onCreate?.(key)} title="Новая задача"><Plus size={16} /></button></div>
      <SortableContext items={byStatus[key].map(task => task.id)} strategy={verticalListSortingStrategy}>
        <ColumnDropZone id={key}>{byStatus[key].length ? <MotionList className="kanban-task-motion-list" itemClassName="kanban-task-motion-item" stagger={0.018}>{byStatus[key].map(task => <TaskCard key={task.id} task={task} onClick={() => onOpen?.(task)} />)}</MotionList> : <div className="column-empty">Перетащите сюда задачу</div>}</ColumnDropZone>
      </SortableContext>
      <button type="button" className="add-task-inline" onClick={() => onCreate?.(key)}><Plus size={15} />Добавить задачу</button>
    </section>)}</div>
  </DndContext>
}
