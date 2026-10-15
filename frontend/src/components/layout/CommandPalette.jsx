import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { Activity, CheckSquare2, FolderKanban, MessageSquare, Settings, Users, Bell } from 'lucide-react'
import api from '../../lib/api'

const pages = [
  { label: 'Главная', path: '/app', icon: Activity },
  { label: 'Проекты', path: '/app/projects', icon: FolderKanban },
  { label: 'Задачи', path: '/app/tasks', icon: CheckSquare2 },
  { label: 'Чаты', path: '/app/chats', icon: MessageSquare },
  { label: 'Команда', path: '/app/team', icon: Users },
  { label: 'Уведомления', path: '/app/notifications', icon: Bell },
  { label: 'Настройки', path: '/app/settings', icon: Settings },
]

export default function CommandPalette({ open, onOpenChange, onSelect }) {
  const projectsQuery = useQuery({ queryKey: ['command-projects'], queryFn: async () => (await api.get('/projects')).data, enabled: open, staleTime: 30000 })
  const tasksQuery = useQuery({ queryKey: ['command-tasks'], queryFn: async () => (await api.get('/tasks')).data, enabled: open, staleTime: 15000 })
  const projects = useMemo(() => (projectsQuery.data || []).filter(project => !project.archived), [projectsQuery.data])
  const tasks = useMemo(() => (tasksQuery.data || []).slice(0, 100), [tasksQuery.data])
  const go = path => { onOpenChange(false); onSelect(path) }

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label="Быстрый поиск" overlayClassName="command-overlay" contentClassName="command-content">
      <div className="command-search-row"><Command.Input autoFocus placeholder="Найти страницу, проект или задачу…" /><kbd>ESC</kbd></div>
      <Command.List>
        <Command.Empty>Совпадений не найдено.</Command.Empty>
        <Command.Group heading="Разделы">
          {pages.map(({ label, path, icon: Icon }) => <Command.Item key={path} value={`страница ${label}`} onSelect={() => go(path)}><Icon size={16} /><span>{label}</span><kbd>Раздел</kbd></Command.Item>)}
        </Command.Group>
        {projects.length > 0 && <Command.Group heading="Проекты">
          {projects.map(project => <Command.Item key={project.id} value={`проект ${project.name} ${project.website_url || ''}`} onSelect={() => go(`/app/projects/${project.id}`)}><FolderKanban size={16} /><span>{project.name}</span><kbd>Проект</kbd></Command.Item>)}
        </Command.Group>}
        {tasks.length > 0 && <Command.Group heading="Задачи">
          {tasks.map(task => <Command.Item key={task.id} value={`задача ${task.title} ${task.description || ''}`} onSelect={() => go(`/app/projects/${task.project_id}/tasks`)}><CheckSquare2 size={16} /><span>{task.title}</span><kbd>{task.status === 'done' ? 'Готово' : 'Задача'}</kbd></Command.Item>)}
        </Command.Group>}
      </Command.List>
      {(projectsQuery.isFetching || tasksQuery.isFetching) && <div className="command-loading"><span className="button-loading-shimmer" />Ищем в ваших данных…</div>}
      <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span><span><kbd>↵</kbd> открыть</span><span><kbd>esc</kbd> закрыть</span></footer>
    </Command.Dialog>
  )
}
