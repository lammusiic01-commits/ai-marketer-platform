import { Link } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ArrowUpRight, FileText } from 'lucide-react'
import api from '../lib/api'
import { Card, EmptyState, Notice, Spinner } from '../components/ui'

export default function Reports() {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: async () => (await api.get('/projects')).data, staleTime: 15000 })
  const projects = projectsQuery.data || []
  const reportsQueries = useQueries({ queries: projects.map(project => ({
    queryKey: ['project-reports', project.id],
    queryFn: async () => (await api.get(`/projects/${project.id}/reports`)).data,
    enabled: projectsQuery.isSuccess,
    staleTime: 15000,
  })) })
  const loading = projectsQuery.isLoading || reportsQueries.some(query => query.isLoading)
  const records = projects.flatMap((project, index) => (reportsQueries[index]?.data || []).map(report => ({ ...report, project_id: project.id, project_name: project.name })))
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))

  if (loading) return <Spinner label="Загружаем отчёты…" />
  if (projectsQuery.isError || reportsQueries.some(query => query.isError)) return <div className="page-stack"><Notice tone="danger">Не удалось загрузить историю отчётов. Обновите страницу или проверьте доступ к проектам.</Notice></div>

  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">АНАЛИТИКА ПРОЕКТОВ</span><h1>Отчёты</h1><p>Сводная история недельных и месячных отчётов по проектам.</p></div></div>
      <Card className="table-card">
        {records.length ? <div className="table-wrap"><table><thead><tr><th>ОТЧЁТ</th><th>ПРОЕКТ</th><th>ТИП</th><th>ДАТА</th><th>СВОДКА</th><th /></tr></thead><tbody>{records.map(report => <tr key={`${report.project_id}-${report.id}`}><td><span className="table-project"><span className="project-avatar"><FileText size={14} /></span><b>Отчёт #{report.id}</b></span></td><td>{report.project_name}</td><td><span className="role-pill">{report.type === 'weekly' ? 'Еженедельный' : 'Ежемесячный'}</span></td><td>{new Date(report.created_at).toLocaleDateString('ru-RU')}</td><td className="report-summary-cell">{report.ai_summary || 'Сводка не заполнена'}</td><td><Link className="text-link" to={`/app/projects/${report.project_id}/reports`}>Открыть <ArrowUpRight size={13} /></Link></td></tr>)}</tbody></table></div> : <EmptyState icon={FileText} title="Отчётов пока нет" body="Сформируйте первый отчёт в разделе «Отчёты» выбранного проекта — он появится в общей истории." action={projects[0] ? <Link className="btn btn-secondary btn-small" to={`/app/projects/${projects[0].id}/reports`}>Открыть проект</Link> : <Link className="btn btn-secondary btn-small" to="/app/projects">Создать проект</Link>} />}
      </Card>
    </div>
  )
}
