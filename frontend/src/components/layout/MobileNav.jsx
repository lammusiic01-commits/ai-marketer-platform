import { NavLink } from 'react-router-dom'
import { CheckSquare2, FolderKanban, House, MessageSquare, UserRound } from 'lucide-react'

const items = [
  { to: '/app', label: 'Главная', icon: House, end: true },
  { to: '/app/projects', label: 'Проекты', icon: FolderKanban },
  { to: '/app/tasks', label: 'Задачи', icon: CheckSquare2 },
  { to: '/app/chats', label: 'Чаты', icon: MessageSquare },
  { to: '/app/settings', label: 'Профиль', icon: UserRound },
]

export default function MobileNav({ unreadChats = 0 }) {
  return <nav className="mobile-bottom-nav" aria-label="Основная навигация">
    {items.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}>
      <span className="mobile-nav-icon"><Icon size={19} strokeWidth={1.7} />{to === '/app/chats' && unreadChats > 0 && <i className="mobile-nav-unread">{unreadChats > 9 ? '9+' : unreadChats}</i>}</span><span>{label}</span>
    </NavLink>)}
  </nav>
}
