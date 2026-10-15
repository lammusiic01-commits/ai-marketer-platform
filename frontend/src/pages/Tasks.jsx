import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare2, Filter, FolderKanban, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import api, { messageOf } from '../lib/api'
import Board from '../components/Kanban/Board'
import { Button, Card, EmptyState, Field, Notice, Spinner } from '../components/ui'

const emptyForm = { title: '', description: '', priority: 'normal', due_date: '', status: 'backlog' }

export default function Tasks() {
  const { projects = [], workspace } = useOutletContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const queryKey = ['workspace-tasks', workspace?.id]
  const [project, setProject] = useState('all')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [projectId, setProjectId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const dialogRef = useRef(null)
  const openerRef = useRef(null)

  const tasksQuery = useQuery({ queryKey, queryFn: async () => (await api.get('/tasks')).data, enabled: Boolean(workspace?.id) })
  const tasks = tasksQuery.data || []
  const selected = useMemo(() => project === 'all' ? tasks : tasks.filter(task => String(task.project_id) === project), [project, tasks])
  const moveMutation = useMutation({
    mutationFn: ({ task, status }) => api.patch(`/tasks/${task.id}/status`, { status }),
    onMutate: async ({ task, status }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey) || []
      queryClient.setQueryData(queryKey, previous.map(item => item.id === task.id ? { ...item, status } : item))
      return { previous }
    },
    onError: (error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      toast.error('Не удалось переместить задачу', { description: messageOf(error) })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  useEffect(() => {
    if (!modal) return undefined
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector('input,textarea,select')?.focus())
    return () => { cancelAnimationFrame(frame); openerRef.current?.focus?.() }
  }, [modal])

  const openCreate = status => {
    if (!projects.length) { toast.error('Сначала создайте проект'); navigate('/app/projects'); return }
    openerRef.current = document.activeElement
    setEditing(null)
    setProjectId(project === 'all' ? String(projects[0].id) : project)
    setForm({ ...emptyForm, status: status || 'backlog' })
    setFormError('')
    setModal(true)
  }
  const openEdit = task => {
    openerRef.current = document.activeElement
    setEditing(task)
    setProjectId(String(task.project_id))
    setForm({ title: task.title || '', description: task.description || '', priority: task.priority || 'normal', due_date: task.due_date?.slice(0, 10) || '', status: task.status || 'backlog' })
    setFormError('')
    setModal(true)
  }
  const closeModal = () => setModal(false)
  const handleDialogKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeModal(); return }
    if (event.key !== 'Tab') return
    const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || [])]
    if (!controls.length) return
    if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus() }
    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus() }
  }

  const saveTask = async event => {
    event.preventDefault()
    if (!projectId) { setFormError('Выберите проект для задачи'); return }
    setSaving(true); setFormError('')
    const body = { ...form, due_date: form.due_date || null, labels: editing?.labels || [], checklist: editing?.checklist || [], assignee_id: editing?.assignee_id ?? null }
    try {
      if (editing) await api.patch(`/tasks/${editing.id}`, body)
      else await api.post(`/projects/${projectId}/tasks`, body)
      await queryClient.invalidateQueries({ queryKey })
      toast.success(editing ? 'Задача обновлена' : 'Задача создана')
      closeModal()
    } catch (error) { setFormError(messageOf(error)) }
    finally { setSaving(false) }
  }

  const hasProjects = projects.length > 0
  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">КОВОРКИНГ</span><h1>Задачи</h1><p>Общий поток задач текущего workspace.</p></div><div className="task-page-actions"><label className="filter-select"><Filter size={15} /><select aria-label="Фильтр по проекту" value={project} onChange={event => setProject(event.target.value)}><option value="all">Все проекты</option>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Button size="small" onClick={() => openCreate('backlog')} disabled={!hasProjects}><Plus size={15} />Новая задача</Button></div></div>
    {tasksQuery.isLoading ? <Spinner label="Загружаем задачи…" /> : tasksQuery.isError ? <Card className="task-error-card"><Notice tone="danger">Не удалось загрузить задачи: {messageOf(tasksQuery.error)}</Notice><Button variant="secondary" onClick={() => tasksQuery.refetch()}>Повторить</Button></Card> : selected.length ? <Board tasks={selected} onMove={(task, status) => moveMutation.mutate({ task, status })} onCreate={openCreate} onOpen={openEdit} /> : <Card><EmptyState icon={CheckSquare2} title={hasProjects ? 'Поток пока пуст' : 'Сначала создайте проект'} body={hasProjects ? 'Создайте первую задачу — команда увидит её в общем канбане.' : 'Задаче нужен проект, чтобы участники и переписка были привязаны к одному контексту.'} action={hasProjects ? <Button variant="secondary" size="small" onClick={() => openCreate('backlog')}><Plus size={14} />Добавить задачу</Button> : <Button variant="secondary" size="small" onClick={() => navigate('/app/projects')}><FolderKanban size={14} />Открыть проекты</Button>} /></Card>}
    {modal && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeModal()}><div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-heading" onKeyDown={handleDialogKeyDown}><div className="dialog-header"><div><span className="eyebrow">РАБОЧИЙ ПОТОК</span><h2 id="task-dialog-heading">{editing ? 'Редактировать задачу' : 'Новая задача'}</h2></div><button type="button" className="icon-button" aria-label="Закрыть окно задачи" onClick={closeModal}><X size={16} /></button></div><form className="dialog-form" onSubmit={saveTask}><Field label="Проект"><select required value={projectId} disabled={Boolean(editing)} onChange={event => setProjectId(event.target.value)}>{projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Название"><input required maxLength="240" value={form.title} onChange={event => setForm(value => ({ ...value, title: event.target.value }))} placeholder="Например, проверить события аналитики" /></Field><Field label="Описание"><textarea rows="3" value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} placeholder="Контекст и критерии готовности" /></Field><div className="task-edit-grid"><Field label="Статус"><select value={form.status} onChange={event => setForm(value => ({ ...value, status: event.target.value }))}><option value="backlog">В очереди</option><option value="in_progress">В работе</option><option value="review">На проверке</option><option value="done">Готово</option></select></Field><Field label="Приоритет"><select value={form.priority} onChange={event => setForm(value => ({ ...value, priority: event.target.value }))}><option value="urgent">Срочно</option><option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option></select></Field></div><Field label="Срок"><input type="date" value={form.due_date} onChange={event => setForm(value => ({ ...value, due_date: event.target.value }))} /></Field>{formError && <Notice tone="danger">{formError}</Notice>}<div className="dialog-actions"><Button type="button" variant="ghost" onClick={closeModal}>Отмена</Button><Button loading={saving}><Plus size={15} />{editing ? 'Сохранить задачу' : 'Создать задачу'}</Button></div></form></div></div>}
  </div>
}
