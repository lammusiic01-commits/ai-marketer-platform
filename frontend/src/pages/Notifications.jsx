import {useCallback,useEffect,useState} from 'react'
import {Bell,Check,CheckCheck,Clock3,RefreshCw} from 'lucide-react'
import api from '../lib/api'
import {Button,Card,EmptyState,Spinner} from '../components/ui'

export default function Notifications(){
 const [items,setItems]=useState([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await api.get('/notifications');setItems(data)}catch(e){setError(e.response?.data?.detail||'Не удалось загрузить уведомления')}finally{setLoading(false)}},[])
 useEffect(()=>{load()},[load])
 const markOne=async id=>{try{await api.patch(`/notifications/${id}/read`);setItems(v=>v.map(n=>n.id===id?{...n,read:true}:n));window.dispatchEvent(new Event('amp:notifications-updated'))}catch(e){setError(e.response?.data?.detail||'Не удалось обновить уведомление')}}
 const markAll=async()=>{try{await api.post('/notifications/mark-all-read');setItems(v=>v.map(n=>({...n,read:true})));window.dispatchEvent(new Event('amp:notifications-updated'))}catch(e){setError(e.response?.data?.detail||'Не удалось обновить уведомления')}}
 const unread=items.filter(n=>!n.read).length
 return <div className="page-stack notifications-page">
  <div className="page-heading"><div><span className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО / СОБЫТИЯ</span><h1>Уведомления</h1><p>Приглашения и изменения в проектах и команде.</p></div><div className="heading-actions"><Button variant="secondary" onClick={load}><RefreshCw size={15}/>Обновить</Button>{unread>0&&<Button onClick={markAll}><CheckCheck size={15}/>Прочитать все</Button>}</div></div>
  {error&&<div className="notice notice-danger">{error}</div>}
  {loading?<Spinner/>:items.length===0?<Card><EmptyState icon={Bell} title="Пока нет уведомлений" body="Новые события команды появятся здесь."/></Card>:<Card className="notification-list">{items.map(n=><article key={n.id} className={`notification-row${n.read?' read':''}`}><span className="notification-indicator">{n.read?<Check size={15}/>:<Bell size={15}/>}</span><div className="notification-copy"><strong>{n.title}</strong><p>{n.body}</p><time><Clock3 size={12}/>{new Date(n.created_at).toLocaleString('ru-RU')}</time></div>{!n.read&&<Button size="small" variant="ghost" onClick={()=>markOne(n.id)}>Отметить прочитанным</Button>}</article>)}</Card>}
 </div>
}
