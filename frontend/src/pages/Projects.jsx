import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { ExternalLink, FolderKanban, Plus, Search, X } from 'lucide-react'
import api, { messageOf } from '../lib/api'
import { Button, Card, EmptyState, Field, Notice, Spinner } from '../components/ui'

export default function Projects() {
  const { projects: initialProjects = [], setProjects, workspace } = useOutletContext()
  const [items, setItems] = useState(initialProjects)
  const [loading, setLoading] = useState(true)
  const [archived, setArchived] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', website_url: '', industry: '' })
  const dialogRef = useRef(null)
  const openerRef = useRef(null)
  const canCreate = ['owner', 'admin', 'manager'].includes(workspace?.role)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/projects')
      setItems(data)
      setProjects?.(data.filter(project => !project.archived))
    } catch (loadError) {
      setError(messageOf(loadError))
    } finally { setLoading(false) }
  }, [setProjects])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!dialog) return undefined
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector('input')?.focus())
    return () => { cancelAnimationFrame(frame); openerRef.current?.focus?.() }
  }, [dialog])

  const visible = useMemo(() => items.filter(project => Boolean(project.archived) === archived && `${project.name} ${project.website_url} ${project.industry}`.toLowerCase().includes(query.trim().toLowerCase())), [items, archived, query])
  const openDialog = () => { openerRef.current = document.activeElement; setError(''); setDialog(true) }
  const closeDialog = () => setDialog(false)
  const onDialogKeyDown = event => {
    if (event.key === 'Escape') { event.preventDefault(); closeDialog(); return }
    if (event.key !== 'Tab') return
    const controls = [...(dialogRef.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || [])]
    if (!controls.length) return
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  const create = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const { data } = await api.post('/projects', form)
      setItems(value => [data, ...value])
      setProjects?.(value => [data, ...value.filter(project => project.id !== data.id)])
      closeDialog(); setForm({ name: '', website_url: '', industry: '' })
    } catch (createError) { setError(messageOf(createError)) }
    finally { setBusy(false) }
  }

  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span><h1>Проекты</h1><p>Отдельный маркетинговый контекст для каждого клиента и направления.</p></div>{canCreate && <Button onClick={openDialog}><Plus size={16} />Создать проект</Button>}</div>
    {error && !dialog && <Notice tone="danger">{error} <Button size="small" variant="secondary" onClick={load}>Повторить</Button></Notice>}
    <div className="list-toolbar"><div className="segmented" role="group" aria-label="Фильтр проектов"><button type="button" aria-pressed={!archived} className={!archived ? 'selected' : ''} onClick={() => setArchived(false)}>Активные</button><button type="button" aria-pressed={archived} className={archived ? 'selected' : ''} onClick={() => setArchived(true)}>Архив</button></div><label className="table-search"><Search size={15} /><input aria-label="Поиск проектов" placeholder="Поиск проекта…" value={query} onChange={event => setQuery(event.target.value)} /><button type="button" className="table-search-clear" onClick={() => setQuery('')} aria-label="Очистить поиск" hidden={!query}><X size={13} /></button></label></div>
    <Card className="table-card">
      {loading ? <Spinner label="Загружаем проекты…" /> : error ? <div className="table-error-state"><Notice tone="danger">Не удалось загрузить список проектов.</Notice><Button variant="secondary" onClick={load}>Повторить</Button></div> : <>
        <div className="table-wrap"><table><thead><tr><th>ПРОЕКТ</th><th>САЙТ</th><th>ИНДУСТРИЯ</th><th>КОМАНДА</th><th>СТАТУС</th><th>СОЗДАН</th></tr></thead><tbody>{visible.map(project => <tr key={project.id}><td><Link className="table-project" to={`/app/projects/${project.id}`}><span className="project-avatar">{project.name?.[0] || 'P'}</span><b>{project.name}</b></Link></td><td>{project.website_url ? <a className="site-link" href={project.website_url} target="_blank" rel="noreferrer">{project.website_url.replace(/^https?:\/\//, '')}<ExternalLink size={12} /></a> : <span className="muted">Не указан</span>}</td><td>{project.industry || '—'}</td><td>{typeof project.member_count === 'number' ? `${project.member_count} участн.` : <span className="muted">Состав не задан</span>}</td><td><span className={`state-pill ${project.archived ? 'archived' : 'active'}`}><i />{project.archived ? 'Архив' : 'Активен'}</span></td><td>{new Date(project.created_at).toLocaleDateString('ru-RU')}</td></tr>)}</tbody></table></div>
        {!visible.length && (query.trim() ? <EmptyState icon={Search} title="Совпадений нет" body="Попробуйте изменить запрос или очистите поиск." action={<Button variant="secondary" size="small" onClick={() => setQuery('')}>Очистить поиск</Button>} /> : archived ? <EmptyState icon={FolderKanban} title="Архив пуст" body="Заархивированные проекты появятся здесь." /> : <EmptyState icon={FolderKanban} title="Ни одного проекта" body="Создайте рабочий проект, чтобы запускать аудит и собирать задачи команды." action={canCreate && <Button variant="secondary" size="small" onClick={openDialog}><Plus size={15} />Создать проект</Button>} />)}
      </>}
    </Card>
    {dialog && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeDialog()}><div ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-heading" onKeyDown={onDialogKeyDown}><div className="dialog-header"><div><span className="eyebrow">НОВЫЙ КОНТЕКСТ</span><h2 id="new-project-heading">Создать проект</h2></div><button type="button" className="icon-button" aria-label="Закрыть окно создания проекта" onClick={closeDialog}><X size={16} /></button></div><form onSubmit={create} className="dialog-form"><Field label="Название проекта"><input autoFocus required maxLength="180" placeholder="Например, Север — интернет-магазин" value={form.name} onChange={event => setForm(value => ({ ...value, name: event.target.value }))} /></Field><Field label="Сайт" hint="Можно добавить позже"><input type="url" placeholder="https://company.ru" value={form.website_url} onChange={event => setForm(value => ({ ...value, website_url: event.target.value }))} /></Field><Field label="Индустрия"><input placeholder="Ритейл, финтех, услуги…" value={form.industry} onChange={event => setForm(value => ({ ...value, industry: event.target.value }))} /></Field>{error && <Notice tone="danger">{error}</Notice>}<div className="dialog-actions"><Button type="button" variant="ghost" onClick={closeDialog}>Отмена</Button><Button loading={busy}><Plus size={15} />Создать проект</Button></div></form></div></div>}
  </div>
}
