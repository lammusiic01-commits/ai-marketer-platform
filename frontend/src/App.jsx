import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getUser } from './lib/auth'
import AppLayout from './components/layout/AppLayout'
import MotionPage from './components/motion/MotionPage'
import { Spinner } from './components/ui'

const Landing = lazy(() => import('./pages/Landing'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Team = lazy(() => import('./pages/Team'))
const Reports = lazy(() => import('./pages/Reports'))
const Chats = lazy(() => import('./pages/Chats'))
const Settings = lazy(() => import('./pages/Settings'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Invite = lazy(() => import('./pages/Invite'))

function Guard({ children }) {
  return getUser() ? children : <Navigate to="/login" replace />
}

function PageBoundary({ children }) {
  return <Suspense fallback={<Spinner label="Загружаем раздел…" />}><MotionPage>{children}</MotionPage></Suspense>
}

export default function App() {
  return <Routes>
    <Route path="/" element={<PageBoundary><Landing /></PageBoundary>} />
    <Route path="/login" element={<PageBoundary><AuthPage mode="login" /></PageBoundary>} />
    <Route path="/register" element={<PageBoundary><AuthPage mode="register" /></PageBoundary>} />
    <Route path="/invite/:token" element={<PageBoundary><Invite /></PageBoundary>} />
    <Route path="/app" element={<Guard><AppLayout /></Guard>}>
      <Route index element={<PageBoundary><Dashboard /></PageBoundary>} />
      <Route path="projects" element={<PageBoundary><Projects /></PageBoundary>} />
      <Route path="projects/:id/*" element={<PageBoundary><ProjectDetail /></PageBoundary>} />
      <Route path="tasks" element={<PageBoundary><Tasks /></PageBoundary>} />
      <Route path="chats" element={<PageBoundary><Chats /></PageBoundary>} />
      <Route path="team" element={<PageBoundary><Team /></PageBoundary>} />
      <Route path="reports" element={<PageBoundary><Reports /></PageBoundary>} />
      <Route path="notifications" element={<PageBoundary><Notifications /></PageBoundary>} />
      <Route path="settings" element={<PageBoundary><Settings /></PageBoundary>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
