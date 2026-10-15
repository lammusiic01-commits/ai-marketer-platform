import { NavLink, Link, useLocation } from 'react-router-dom'
import { Activity, LayoutDashboard, FolderKanban, CheckSquare2, Users, Settings, ChevronDown, Plus, PanelLeftClose, MessageSquare, FileText } from 'lucide-react'
import MotionList from '../motion/MotionList'

const items = [
  { to: '/app', label: 'Главная', icon: LayoutDashboard, end: true },
  { to: '/app/projects', label: 'Проекты', icon: FolderKanban },
  { to: '/app/tasks', label: 'Задачи', icon: CheckSquare2 },
  { to: '/app/chats', label: 'Чаты', icon: MessageSquare },
  { to: '/app/team', label: 'Команда', icon: Users },
  { to: '/app/reports', label: 'Отчёты', icon: FileText },
]

export default function Sidebar({ workspace, onWorkspaceChange, projects = [], unreadChats = 0, workspaceOpen = false, onClose }) {
  const location = useLocation()
  return (
    <aside className="sidebar">
      <div className="brand-row"><Link to="/app" className="brand"><span className="brand-mark"><Activity size={18} /></span><span>AI <b>MARKETER</b></span></Link><button type="button" className="icon-button sidebar-close" onClick={onClose} aria-label="Свернуть меню"><PanelLeftClose size={17} /></button></div>
      <button type="button" className="workspace-switch" onClick={onWorkspaceChange} aria-expanded={workspaceOpen}><span className="workspace-symbol">{(workspace?.name || 'М')[0]}</span><span className="workspace-copy"><b>{workspace?.name || 'Моя команда'}</b><small>Рабочее пространство</small></span><ChevronDown size={15} /></button>
      <div className="nav-group-label">РАБОЧЕЕ ПРОСТРАНСТВО</div>
      <nav className="side-nav" aria-label="Основная навигация">
        {items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <item.icon size={18} strokeWidth={1.6} /><span>{item.label}</span>{item.to === '/app/chats' && unreadChats > 0 && <b className="nav-unread-badge">{unreadChats > 99 ? '99+' : unreadChats}</b>}
        </NavLink>)}
      </nav>
      <div className="nav-group-head"><span>ПРОЕКТЫ</span><Link to="/app/projects" className="tiny-action" title="Все проекты" aria-label="Все проекты"><Plus size={15} /></Link></div>
      <MotionList className="project-nav" itemClassName="project-nav-motion-item" stagger={0.02}>{projects.length ? projects.slice(0, 6).map(project => <Link key={project.id} to={`/app/projects/${project.id}`} onClick={onClose} className={`project-nav-item ${location.pathname.includes(`/projects/${project.id}`) ? 'selected' : ''}`}><span className="project-dot" />{project.name}</Link>) : <span className="nav-empty">Создайте первый проект</span>}</MotionList>
      <div className="sidebar-bottom"><NavLink to="/app/settings" onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Settings size={18} strokeWidth={1.6} /><span>Настройки</span></NavLink><div className="sidebar-status"><span className="status-dot" />Система работает</div></div>
    </aside>
  )
}
