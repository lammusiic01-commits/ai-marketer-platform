import axios from 'axios'
const api=axios.create({baseURL:'/api',headers:{'Content-Type':'application/json'}})
api.interceptors.request.use(config=>{const token=localStorage.getItem('amp_token');if(token)config.headers.Authorization=`Bearer ${token}`;return config})
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401){localStorage.removeItem('amp_token');localStorage.removeItem('amp_user')}return Promise.reject(e)})
export default api
export const messageOf=e=>e?.response?.data?.detail||e?.message||'Не удалось выполнить запрос'