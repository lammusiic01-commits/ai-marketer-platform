export const rubles=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(n)||0)+' ₽'
export const initials=name=>(name||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'AM'
export const prettyDate=value=>value?new Date(value).toLocaleDateString('ru-RU',{day:'numeric',month:'short'}):'Без срока'