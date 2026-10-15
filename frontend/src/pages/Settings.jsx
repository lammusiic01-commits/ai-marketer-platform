import {useEffect,useState} from 'react'
import {useOutletContext} from 'react-router-dom'
import {Bell,LockKeyhole,Save,UserRound,Users} from 'lucide-react'
import api,{messageOf} from '../lib/api'
import {Button,Card,Field,Notice} from '../components/ui'

const defaultPrefs={assigned:true,urgent:true,weekly:false,integrations:true}
export default function Settings(){
 const {user,workspace}=useOutletContext()
 const [name,setName]=useState(user?.name||'')
 const [ws,setWs]=useState(workspace?.name||'Моя команда')
 const [notice,setNotice]=useState('')
 const [error,setError]=useState('')
 const [tab,setTab]=useState('profile')
 const [prefs,setPrefs]=useState(()=>{try{return {...defaultPrefs,...JSON.parse(localStorage.getItem('amp_notification_prefs')||'{}')}}catch{return defaultPrefs}})
 useEffect(()=>{setName(user?.name||'');setWs(workspace?.name||'Моя команда')},[user,workspace])
 const save=async e=>{
  e.preventDefault();setError('');setNotice('')
  try{const {data}=await api.patch('/auth/me',{name});localStorage.setItem('amp_user',JSON.stringify(data));setNotice('Профиль обновлён');setTimeout(()=>window.location.reload(),450)}catch(e){setError(messageOf(e))}
 }
 const saveWorkspace=async e=>{
  e.preventDefault();setError('');setNotice('')
  if(!workspace?.id){setError('Не удалось определить рабочее пространство');return}
  try{const {data}=await api.patch(`/workspaces/${workspace.id}`,{name:ws});const updated={...workspace,...data};localStorage.setItem('amp_workspace',JSON.stringify(updated));setNotice('Название рабочего пространства сохранено');setTimeout(()=>window.location.reload(),450)}catch(e){setError(messageOf(e))}
 }
 const savePrefs=e=>{e.preventDefault();localStorage.setItem('amp_notification_prefs',JSON.stringify(prefs));setNotice('Настройки уведомлений сохранены');setError('')}
 const canEditWorkspace=['owner','admin'].includes(workspace?.role)
 const preferenceRows=[['assigned','Назначение новой задачи'],['urgent','Срочный приоритет'],['weekly','Еженедельный отчёт'],['integrations','Состояние интеграций']]
 return <div className="page-stack">
  <div className="page-heading"><div><span className="eyebrow">ПРОФИЛЬ И WORKSPACE</span><h1>Настройки</h1><p>Параметры профиля, пространства и подключений.</p></div></div>
  <div className="settings-layout">
   <nav className="settings-tabs">{[['profile','Профиль',UserRound],['workspace','Workspace',Users],['security','Безопасность',LockKeyhole],['notifications','Уведомления',Bell]].map(([k,label,I])=><button type="button" key={k} onClick={()=>{setTab(k);setNotice('');setError('')}} className={tab===k?'active':''}><I size={16}/>{label}</button>)}</nav>
   <Card className="settings-card">
    {error&&<Notice tone="danger">{error}</Notice>}{notice&&<Notice tone="success">{notice}</Notice>}
    {tab==='profile'&&<form className="settings-form" onSubmit={save}><div className="settings-section-title"><h2>Профиль</h2><p>Имя для отображения в команде.</p></div><Field label="Имя"><input required minLength="2" maxLength="120" value={name} onChange={e=>setName(e.target.value)}/></Field><Field label="Email"><input value={user?.email||''} disabled/></Field><Button><Save size={15}/>Сохранить изменения</Button></form>}
    {tab==='workspace'&&<form className="settings-form" onSubmit={saveWorkspace}><div className="settings-section-title"><h2>Workspace</h2><p>Общие параметры текущего рабочего пространства.</p></div><Field label="Название"><input required maxLength="160" value={ws} disabled={!canEditWorkspace} onChange={e=>setWs(e.target.value)}/></Field><Field label="Тариф"><input value={workspace?.plan==='free'?'Бесплатный план':workspace?.plan||'Бесплатный план'} disabled/></Field>{canEditWorkspace?<Button><Save size={15}/>Сохранить workspace</Button>:<Notice tone="info">Переименовать workspace может только владелец или администратор.</Notice>}</form>}
    {tab==='security'&&<div className="settings-form"><div className="settings-section-title"><h2>Безопасность</h2><p>Сессия и хранение данных.</p></div><Notice tone="success"><LockKeyhole size={15}/> Пароли хранятся в виде bcrypt-хэшей. Интеграционные секреты шифруются Fernet.</Notice><p className="muted">Сессия JWT действует 30 дней. Локальная база SQLite находится в корне проекта; PostgreSQL задаётся через DATABASE_URL.</p></div>}
    {tab==='notifications'&&<form className="settings-form" onSubmit={savePrefs}><div className="settings-section-title"><h2>Уведомления</h2><p>Сохранённые предпочтения отображения событий.</p></div>{preferenceRows.map(([key,label])=><label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(prefs[key])} onChange={e=>setPrefs(v=>({...v,[key]:e.target.checked}))}/></label>)}<Button><Save size={15}/>Сохранить настройки</Button><Notice tone="info">Email-рассылка требует заполнить SMTP-параметры в `.env`.</Notice></form>}
   </Card>
  </div>
 </div>
}
