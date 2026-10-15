import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, BarChart3, CheckSquare2, FileText, Globe2, Lightbulb, Megaphone, MessageSquare, MousePointer2, PenLine, Plug, Search, ShieldCheck, Users, WalletCards } from 'lucide-react'
import api, { messageOf } from '../lib/api'
import { Button, Notice, Spinner } from '../components/ui'
import ToolPage from './project/ToolPage'

const tabs = [
  ['overview', 'Обзор', Activity], ['tasks', 'Задачи', CheckSquare2], ['campaigns', 'Кампании', Megaphone],
  ['bot-shield', 'Bot Shield', ShieldCheck], ['seo', 'SEO-аудит', Search], ['geo', 'GEO', Globe2],
  ['competitors', 'Конкуренты', Users], ['copywriting', 'Копирайт', PenLine], ['roi', 'ROI', WalletCards],
  ['hypotheses', 'Гипотезы', Lightbulb], ['reports', 'Отчёты', FileText], ['loyalty', 'Лояльность', MousePointer2], ['integrations', 'Интеграции', Plug],
]

export default function ProjectDetail() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const section = location.pathname.split('/').filter(Boolean)[3] || 'overview'

  useEffect(() => {
    let active = true
    setProject(null); setError(''); setLoading(true)
    api.get(`/projects/${id}`).then(response => { if (active) setProject(response.data) })
      .catch(requestError => { if (active) setError(messageOf(requestError)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading) return <Spinner label="Загружаем проект…" />
  if (error) return <div className="page-stack"><Notice tone="danger">{error}</Notice><Link to="/app/projects" className="text-link"><ArrowLeft size={15} />К проектам</Link></div>
  if (!project) return <Spinner label="Подготавливаем проект…" />

  return <div className="project-page">
    <div className="project-header"><div className="project-title-wrap"><Link to="/app/projects" className="back-link"><ArrowLeft size={14} />Проекты</Link><div className="project-title-row"><span className="project-avatar large">{project.name?.[0] || 'P'}</span><div><h1>{project.name}</h1><div className="project-subline"><span>{project.website_url || 'Сайт не добавлен'}</span><span className="sep-dot" />{project.industry || 'Индустрия не указана'}</div></div></div></div><Button variant="secondary" onClick={() => navigate(`/app/projects/${id}/integrations`)}><Plug size={15} />Интеграции</Button></div>
    <div className="project-layout"><aside className="project-side-nav" aria-label={`Разделы проекта ${project.name}`}><div className="project-nav-title">ПРОЕКТ</div>{tabs.map(([path, label, Icon]) => <Link key={path} to={path === 'overview' ? `/app/projects/${id}` : `/app/projects/${id}/${path}`} aria-current={section === path ? 'page' : undefined} className={`project-section-link ${section === path ? 'active' : ''}`}><Icon size={16} strokeWidth={1.6} /><span>{label}</span></Link>)}<Link to={`/app/chats?projectId=${id}`} aria-current={location.pathname === '/app/chats' && new URLSearchParams(location.search).get('projectId') === String(id) ? 'page' : undefined} className="project-section-link project-chat-link"><MessageSquare size={16} strokeWidth={1.6} /><span>Чат проекта</span><span className="project-chat-live" aria-hidden="true" /></Link><div className="project-nav-foot"><BarChart3 size={15} />Маркетинговый контур</div></aside><div className="project-content"><ToolPage key={`${id}:${section}`} project={project} section={section} /></div></div>
  </div>
}
