import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { Activity, ArrowRight, CheckSquare2, FolderKanban, Plus, ShieldCheck, TriangleAlert, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api, { messageOf } from '../lib/api'
import { prettyDate } from '../lib/utils'
import MetricCard from '../components/MetricCard'
import { Button, Card, EmptyState, Notice, Spinner } from '../components/ui'
import MotionList from '../components/motion/MotionList'

const chartData = [{ d: '15 сен', v: 410 }, { d: '20 сен', v: 490 }, { d: '25 сен', v: 450 }, { d: '30 сен', v: 610 }, { d: '5 окт', v: 580 }, { d: '10 окт', v: 760 }, { d: '14 окт', v: 820 }]
const dateLabel = () => new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toLocaleUpperCase('ru-RU')

export default function Dashboard() {
  const { workspace, user } = useOutletContext()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!workspace?.id) { setLoading(false); setError('Выберите рабочее пространство, чтобы загрузить сводку.'); return }
    setLoading(true)
    setError('')
    try { const response = await api.get(`/workspaces/${workspace.id}/dashboard`); setData(response.data) }
    catch (requestError) { setError(messageOf(requestError)); setData(null) }
    finally { setLoading(false) }
  }, [workspace?.id])
  useEffect(() => { load() }, [load])
  const name = (user?.name || '').split(' ')[0] || 'коллега'
  if (loading) return <Spinner label="Загружаем сводку workspace…" />

  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">{dateLabel()}</span><h1>Здравствуйте, {name}</h1><p>Состояние проектов и ближайшие действия команды.</p></div><Link to="/app/projects" className="btn btn-primary"><Plus size={16} />Новый проект</Link></div>
    {error ? <Card className="dashboard-error-card"><Notice tone="danger">Не удалось загрузить данные сводки: {error}</Notice><Button variant="secondary" onClick={load}>Повторить</Button></Card> : <>
      <div className="metrics-grid"><MetricCard label="Активные проекты" value={data?.active_projects ?? 0} icon={FolderKanban} tone="indigo" note="В текущем workspace" /><MetricCard label="Открытые задачи" value={data?.open_tasks ?? 0} icon={CheckSquare2} tone="blue" note="Во всех проектах" /><MetricCard label="Срочные задачи" value={data?.urgent_tasks ?? 0} icon={TriangleAlert} tone="red" note="Требуют внимания" /><MetricCard label="Завершено за неделю" value={data?.completed_week ?? 0} icon={TrendingUp} tone="green" note="Задач закрыто" /></div>
      <div className="dashboard-grid">
        <Card className="chart-card"><div className="card-heading"><div><h2>Маркетинговый обзор</h2><p>Демонстрационный график — не данные workspace</p></div><span className="subtle-label">ДЕМО-СРЕЗ</span></div><div className="overview-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7773f3" stopOpacity={.24} /><stop offset="95%" stopColor="#7773f3" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#27272a" vertical={false} /><XAxis dataKey="d" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: '#18181b', border: '1px solid #303036', borderRadius: 8, color: '#fafafa' }} /><Area type="monotone" dataKey="v" stroke="#9b98ff" strokeWidth={2} fill="url(#traffic-fill)" /></AreaChart></ResponsiveContainer></div><div className="chart-footer"><span><i className="legend-dot" />Пример динамики</span><span>Подключите источник данных для реальной аналитики</span></div></Card>
        <Card className="insight-card"><div className="card-heading"><div><span className="insight-icon"><Activity size={17} /></span><h2>Первый шаг</h2></div><span className="subtle-label">НАСТРОЙКА</span></div><div className="insight-body"><div className="insight-tag">СОБЕРИТЕ БАЗОВЫЕ СИГНАЛЫ</div><h3>Добавьте сайт к проекту</h3><p>После этого вы сможете запускать SEO-аудит и собирать задачи команды в одном контексте.</p><Link to="/app/projects" className="text-link">Открыть проекты <ArrowRight size={14} /></Link></div><div className="insight-foot"><ShieldCheck size={15} />Рекомендации появятся после подключения источников</div></Card>
        <Card className="projects-card"><div className="card-heading"><div><h2>Активные проекты</h2><p>Рабочие пространства команды</p></div><Link to="/app/projects" className="text-link">Все проекты <ArrowRight size={14} /></Link></div>{data?.projects?.length ? <MotionList className="dashboard-project-list" itemClassName="dashboard-project-motion-item" stagger={.035}>{data.projects.slice(0, 4).map(project => <Link key={project.id} className="project-row" to={`/app/projects/${project.id}`}><span className="project-avatar">{project.name?.[0] || 'P'}</span><span className="project-row-name"><b>{project.name}</b><small>{project.website_url || project.industry || 'Сайт не добавлен'}</small></span><span className="project-row-meta">Открыть <ArrowRight size={14} /></span></Link>)}</MotionList> : <EmptyState icon={FolderKanban} title="Пока нет проектов" body="Создайте проект для клиента или своего бизнеса, чтобы начать собирать маркетинговые данные." action={<Link to="/app/projects" className="btn btn-secondary btn-small">Создать проект</Link>} />}</Card>
        <Card className="today-card"><div className="card-heading"><div><h2>Задачи на сегодня</h2><p>Открытые задачи со сроком на текущую дату</p></div><Link to="/app/tasks" className="text-link">Все задачи <ArrowRight size={14} /></Link></div>{data?.tasks?.length ? <MotionList className="dashboard-today-list" itemClassName="dashboard-today-motion-item" stagger={.025}>{data.tasks.slice(0, 5).map(task => <div className="today-row" key={task.id}><span className={`task-check ${task.priority === 'urgent' ? 'urgent' : ''}`} /><span>{task.title}</span><small>{prettyDate(task.due_date)}</small></div>)}</MotionList> : <div className="soft-empty"><CheckSquare2 size={17} /><span>На сегодня задач нет. Новые задачи можно добавить на странице «Задачи».</span></div>}</Card>
      </div>
      <div className="dashboard-footnote"><Activity size={14} />Метрики проектов загружены из workspace; демонстрационный график явно отмечен и не выдаётся за подключённую аналитику.</div>
    </>}
  </div>
}
