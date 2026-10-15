import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Copy, Mail, MessageSquare, Plus, Trash2, Users } from 'lucide-react'
import api, { messageOf } from '../lib/api'
import { initials } from '../lib/utils'
import { Button, Card, EmptyState, Field, Notice } from '../components/ui'

const roleLabels = { owner: 'Владелец', admin: 'Администратор', manager: 'Менеджер', specialist: 'Специалист', viewer: 'Наблюдатель' }
const roles = ['admin', 'manager', 'specialist', 'viewer']

export default function Team() {
  const { workspace, user } = useOutletContext()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [invites, setInvites] = useState([])
  const [dialog, setDialog] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('specialist')
  const [sending, setSending] = useState(false)
  const [chatUserId, setChatUserId] = useState(null)
  const [inviteUrl, setInviteUrl] = useState('')
  const canManage = ['owner', 'admin'].includes(workspace?.role)
  const canInvite = ['owner', 'admin', 'manager'].includes(workspace?.role)

  const load = useCallback(async () => {
    const workspaceId = workspace?.id
    if (!workspaceId) return
    try {
      const [members, pending] = await Promise.all([
        api.get(`/workspaces/${workspaceId}/members`),
        canInvite ? api.get(`/workspaces/${workspaceId}/invitations`) : Promise.resolve({ data: [] }),
      ])
      setRows(members.data)
      setInvites(pending.data)
      setError('')
    } catch (loadError) {
      setError(messageOf(loadError))
    }
  }, [workspace?.id, canInvite])

  useEffect(() => { load() }, [load])

  const invite = async event => {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const { data } = await api.post(`/workspaces/${workspace.id}/invite`, { email, role })
      setInvites(value => [data, ...value.filter(item => item.id !== data.id)])
      setInviteUrl(data.url)
      setEmail('')
      return true
    } catch (inviteError) {
      setError(messageOf(inviteError))
      return false
    } finally {
      setSending(false)
    }
  }

  const changeRole = async (member, nextRole) => {
    try {
      const { data } = await api.patch(`/workspaces/${workspace.id}/members/${member.id}`, { email: member.email, role: nextRole })
      setRows(value => value.map(row => row.id === member.id ? { ...row, role: data.role } : row))
    } catch (changeError) {
      setError(messageOf(changeError))
      load()
    }
  }

  const removeMember = async member => {
    if (!window.confirm(`Удалить ${member.name} из рабочего пространства?`)) return
    try {
      await api.delete(`/workspaces/${workspace.id}/members/${member.id}`)
      setRows(value => value.filter(row => row.id !== member.id))
    } catch (removeError) {
      setError(messageOf(removeError))
    }
  }

  const startChat = async member => {
    setChatUserId(member.id)
    setError('')
    try {
      const { data } = await api.post('/chats/direct', { user_id: member.id })
      navigate(`/app/chats?conversationId=${data.id}`)
    } catch (chatError) {
      setError(messageOf(chatError))
    } finally {
      setChatUserId(null)
    }
  }

  const revoke = async invitation => {
    if (!window.confirm(`Отозвать приглашение для ${invitation.email}?`)) return
    try {
      await api.delete(`/workspaces/${workspace.id}/invitations/${invitation.id}`)
      setInvites(value => value.filter(row => row.id !== invitation.id))
    } catch (revokeError) {
      setError(messageOf(revokeError))
    }
  }

  const copyLink = async url => {
    try {
      await navigator.clipboard.writeText(url)
      setInviteUrl(url)
    } catch {
      setError('Не удалось скопировать ссылку; откройте её кнопкой «Открыть»')
    }
  }

  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">ДОСТУП И РОЛИ</span><h1>Команда</h1><p>Управляйте участниками и приглашениями в workspace.</p></div>{canInvite && <Button onClick={() => setDialog(true)}><Plus size={15} />Пригласить</Button>}</div>
    {error && <Notice tone="danger">{error}</Notice>}
    {inviteUrl && <Notice tone="success"><Mail size={15} /> Ссылка создана: <a className="text-link" href={inviteUrl}>открыть приглашение</a><button type="button" className="copy-link-button" onClick={() => copyLink(inviteUrl)}><Copy size={13} />Скопировать</button></Notice>}
    <Card className="table-card">
      <div className="card-heading"><div><h2>Участники workspace</h2><p>{rows.length} в команде</p></div></div>
      <div className="table-wrap"><table><thead><tr><th>УЧАСТНИК</th><th>EMAIL</th><th>РОЛЬ</th><th>В ПРОЕКТАХ</th><th>ДОБАВЛЕН</th><th>ДЕЙСТВИЯ</th></tr></thead><tbody>
        {rows.map(member => <tr key={member.id}>
          <td><span className="table-project"><span className="avatar">{initials(member.name)}</span><b>{member.name}{member.id === user?.id ? ' (вы)' : ''}</b></span></td>
          <td>{member.email}</td>
          <td>{canManage && member.role !== 'owner' ? <select className="table-role-select" value={member.role} onChange={event => changeRole(member, event.target.value)} aria-label={`Роль ${member.name}`}>{roles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select> : <span className="role-pill">{roleLabels[member.role] || member.role}</span>}</td>
          <td>{member.projects_count ?? 0}</td>
          <td>{new Date(member.created_at).toLocaleDateString('ru-RU')}</td>
          <td><span className="team-row-actions">{member.id !== user?.id && <button type="button" className="icon-button team-chat-action" title={`Написать ${member.name}`} aria-label={`Написать ${member.name}`} disabled={chatUserId === member.id} onClick={() => startChat(member)}><MessageSquare size={15} /></button>}{canManage && member.role !== 'owner' && <button type="button" className="icon-button danger-icon-button" aria-label={`Удалить ${member.name}`} title="Удалить участника" onClick={() => removeMember(member)}><Trash2 size={15} /></button>}</span></td>
        </tr>)}
      </tbody></table></div>
      {!rows.length && <EmptyState icon={Users} title="Команда начинается с вас" body="Пригласите коллегу и назначьте ему подходящую роль." />}
    </Card>
    {canInvite && <Card className="table-card"><div className="card-heading"><div><h2>Ожидают принятия</h2><p>{invites.length} активных приглашений · ссылки действуют 7 дней</p></div></div>{invites.length ? invites.map(item => <div className="today-row invite-row" key={item.id}><Mail size={15} /><span>{item.email}</span><span className="role-pill">{roleLabels[item.role] || item.role}</span><span className="muted">до {new Date(item.expires_at).toLocaleDateString('ru-RU')}</span><a className="text-link" href={item.url}>Открыть</a><button type="button" className="icon-button" title="Скопировать ссылку" aria-label="Скопировать ссылку" onClick={() => copyLink(item.url)}><Copy size={14} /></button><button type="button" className="icon-button" title="Отозвать" aria-label="Отозвать приглашение" onClick={() => revoke(item)}><Trash2 size={14} /></button></div>) : <div className="team-empty-note">Активных приглашений нет.</div>}</Card>}
    {dialog && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setDialog(false)}><div className="dialog"><div className="dialog-header"><div><h2>Пригласить в workspace</h2><p>Срок действия ссылки — 7 дней.</p></div><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => setDialog(false)}>×</button></div><form className="dialog-form" onSubmit={async event => { if (await invite(event)) setDialog(false) }}><Field label="Рабочий email"><input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="colleague@company.ru" /></Field><Field label="Роль"><select value={role} onChange={event => setRole(event.target.value)}><option value="admin">Администратор</option><option value="manager">Менеджер</option><option value="specialist">Специалист</option><option value="viewer">Наблюдатель</option></select></Field><div className="dialog-actions"><Button type="button" variant="ghost" onClick={() => setDialog(false)}>Отмена</Button><Button loading={sending}><Mail size={15} />Создать приглашение</Button></div></form></div></div>}
  </div>
}
