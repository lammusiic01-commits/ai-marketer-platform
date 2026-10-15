import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Command, LogOut, Menu, Plus, Search, Settings } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../lib/api'
import { getUser, clearSession } from '../../lib/auth'
import { initials } from '../../lib/utils'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import CommandPalette from './CommandPalette'
import MotionPage from '../motion/MotionPage'

function readWorkspace() {
  try { return JSON.parse(localStorage.getItem('amp_workspace') || 'null') } catch { return null }
}

export default function AppLayout() {
  const [user] = useState(getUser())
  const [workspace, setWorkspace] = useState(readWorkspace)
  const [projects, setProjects] = useState([])
  const [workspaces, setWorkspaces] = useState([])
  const [notifications, setNotifications] = useState([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { data: chats = [] } = useQuery({ queryKey: ['chats'], queryFn: async () => (await api.get('/chats')).data, staleTime: 10000 })
  const chatUnread = chats.reduce((total, chat) => total + (chat.unread_count || 0), 0)
  const unreadNotifications = notifications.filter(item => !item.read).length

  const loadNotifications = () => api.get('/notifications').then(response => setNotifications(response.data)).catch(() => {})
  useEffect(() => {
    api.get('/projects').then(response => setProjects(response.data.filter(project => !project.archived))).catch(() => {})
    api.get('/workspaces').then(response => {
      setWorkspaces(response.data)
      const current = response.data.find(item => item.id === workspace?.id) || response.data[0]
      if (current) {
        setWorkspace(current)
        localStorage.setItem('amp_workspace', JSON.stringify(current))
      }
    }).catch(() => {})
    loadNotifications()
    const refresh = () => loadNotifications()
    window.addEventListener('amp:notifications-updated', refresh)
    return () => window.removeEventListener('amp:notifications-updated', refresh)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setWorkspaceOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handleKey = event => {
      const active = document.activeElement
      const typing = active?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setSearchOpen(true)
      } else if (event.key === 'Escape') {
        setSearchOpen(false)
        setMobileOpen(false)
        setWorkspaceOpen(false)
        setProfileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const logout = () => { clearSession(); navigate('/') }
  const pageTitle = location.pathname.includes('/chats') ? 'Чаты'
    : location.pathname.includes('/notifications') ? 'Уведомления'
      : location.pathname.includes('/projects/') ? 'Проекты'
        : location.pathname.includes('/projects') ? 'Проекты'
          : location.pathname.includes('/tasks') ? 'Задачи'
            : location.pathname.includes('/team') ? 'Команда'
              : location.pathname.includes('/settings') ? 'Настройки' : 'Главная'

  const chooseWorkspace = async nextWorkspace => {
    try {
      if (workspace?.id !== nextWorkspace.id) {
        const { data } = await api.post(`/workspaces/${nextWorkspace.id}/switch`)
        localStorage.setItem('amp_token', data.token)
      }
      setWorkspace(nextWorkspace)
      localStorage.setItem('amp_workspace', JSON.stringify(nextWorkspace))
      setWorkspaceOpen(false)
      window.location.reload()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Не удалось переключить рабочее пространство')
    }
  }

  const openResult = path => { navigate(path); setSearchOpen(false) }

  return (
    <div className={`app-shell${mobileOpen ? ' mobile-drawer-open' : ''}`}>
      <Sidebar workspace={workspace} projects={projects} unreadChats={chatUnread} workspaceOpen={workspaceOpen} onWorkspaceChange={() => setWorkspaceOpen(value => !value)} onClose={() => setMobileOpen(false)} />
      {workspaceOpen && <div className="workspace-popover"><div className="popover-title">Рабочие пространства</div>{workspaces.map(item => <button type="button" key={item.id} className="workspace-option" onClick={() => chooseWorkspace(item)}><span>{item.name}</span><small>{workspace?.id === item.id ? 'Текущее' : 'Открыть'}</small></button>)}<button type="button" className="workspace-settings-action" onClick={() => { setWorkspaceOpen(false); navigate('/app/settings') }}><Plus size={15} />Настройки пространства</button></div>}
      {mobileOpen && <button type="button" className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <button type="button" className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Открыть меню"><Menu size={19} /></button>
          <div className="breadcrumbs"><span>{workspace?.name || 'Workspace'}</span><b>/</b><strong>{pageTitle}</strong></div>
          <div className="top-actions">
            <button type="button" className="search-trigger" onClick={() => setSearchOpen(true)}><Search size={15} /><span>Поиск</span><kbd><Command size={11} />K</kbd></button>
            <button type="button" className="icon-button notification-button" aria-label="Уведомления" onClick={() => navigate('/app/notifications')}><Bell size={17} />{unreadNotifications > 0 && <i />}</button>
            <div className="profile-wrap"><button type="button" className="profile-chip" onClick={() => setProfileOpen(value => !value)} aria-expanded={profileOpen}><span className="avatar">{initials(user?.name)}</span><span className="profile-name">{user?.name || 'Пользователь'}</span></button>{profileOpen && <div className="profile-menu"><button type="button" onClick={() => { setProfileOpen(false); navigate('/app/settings') }}><Settings size={15} />Настройки профиля</button><button type="button" onClick={logout}><LogOut size={15} />Выйти</button></div>}</div>
          </div>
        </header>
        <div className="page-content"><MotionPage key={location.pathname}><Outlet context={{ workspace, projects, setProjects, user }} /></MotionPage></div>
      </main>
      <MobileNav unreadChats={chatUnread} />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} onSelect={openResult} />
    </div>
  )
}
