import {Link} from 'react-router-dom'
import {Activity,ArrowRight,ShieldCheck,Sparkles,Search,Globe2,Users,ChartNoAxesCombined,Check,MoveUpRight} from 'lucide-react'
const features=[{icon:ShieldCheck,title:'Bot Shield',text:'Находит аномальные визиты и оценивает потери рекламного бюджета.'},{icon:Sparkles,title:'AI-кампании',text:'Собирает структуру, гипотезы и рекламные тексты в одном рабочем потоке.'},{icon:Search,title:'SEO-аудит',text:'Проверяет метатеги, заголовки, индексирование и технические сигналы.'},{icon:Globe2,title:'GEO-видимость',text:'Помогает следить за карточкой бизнеса, отзывами и локальным присутствием.'},{icon:ChartNoAxesCombined,title:'Конкурентная среда',text:'Сравнивает до 1 000 URL по on-page сигналам и содержанию.'},{icon:Users,title:'Команда и проекты',text:'Клиенты, задачи, роли и маркетинговые инструменты — в одном workspace.'}]
export default function Landing(){
 return <div className="landing">
  <header className="landing-header">
   <Link to="/" className="brand"><span className="brand-mark"><Activity size={18}/></span><span>AI <b>MARKETER</b></span></Link>
   <nav><a href="#platform">Платформа</a><a href="#teams">Для команд</a></nav>
   <div className="landing-actions"><Link className="btn btn-ghost" to="/login">Войти</Link><Link className="btn btn-primary" to="/register">Начать бесплатно <ArrowRight size={15}/></Link></div>
  </header>
  <main>
   <section className="hero">
    <div className="hero-copy">
     <div className="eyebrow"><span className="status-dot"/>МАРКЕТИНГОВАЯ ОПЕРАЦИОННАЯ СИСТЕМА</div>
     <h1>AI-платформа для<br/><span>маркетинговых команд</span></h1>
     <p className="hero-subtitle">SEO · GEO · SMM · Контекст. Коворкинг + автоматизация + AI в одном окне.</p>
     <div className="hero-actions"><Link to="/register" className="btn btn-primary btn-large">Начать бесплатно <ArrowRight size={16}/></Link><Link to="/login" className="btn btn-secondary btn-large">Войти в рабочее пространство</Link></div>
     <div className="hero-proof"><div className="proof-avatars"><span>А</span><span>М</span><span>К</span></div><span>Одна команда. Все маркетинговые процессы.</span></div>
    </div>
    <div className="hero-visual">
     <div className="preview-window">
      <div className="preview-bar"><div className="window-dots"><i/><i/><i/></div><span>Обзор · Проект «Север»</span><MoveUpRight size={15}/></div>
      <div className="preview-body">
       <div className="preview-sidebar"><span className="preview-logo"><Activity size={15}/></span><i/><i/><i/><i/><i/></div>
       <div className="preview-main">
        <div className="preview-heading"><div><small>СРЕДА, 14 ОКТЯБРЯ</small><b>Добрый день, Алексей</b></div><span className="preview-pill">Все каналы</span></div>
        <div className="preview-metrics"><div><small>ТРАФИК</small><b>24 860</b><em>+12,4%</em></div><div><small>КОНВЕРСИИ</small><b>318</b><em>+8,2%</em></div><div><small>БОТЫ</small><b>4,8%</b><em className="low">−2,1%</em></div></div>
        <div className="preview-chart"><div className="chart-label"><b>Динамика трафика</b><span>Последние 30 дней</span></div><svg viewBox="0 0 540 125" preserveAspectRatio="none" aria-label="График трафика"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity=".22"/><stop offset="1" stopColor="#6366f1" stopOpacity="0"/></linearGradient></defs><path d="M0,100 C28,94 34,84 60,89 S95,67 120,75 S153,52 180,67 S210,39 240,51 S276,68 302,43 S337,55 363,33 S396,48 420,30 S457,42 480,18 S515,36 540,9 V125 H0Z" fill="url(#area)"/><path d="M0,100 C28,94 34,84 60,89 S95,67 120,75 S153,52 180,67 S210,39 240,51 S276,68 302,43 S337,55 363,33 S396,48 420,30 S457,42 480,18 S515,36 540,9" fill="none" stroke="#818cf8" strokeWidth="2"/></svg></div>
        <div className="preview-alert"><span><ShieldCheck size={16}/></span><div><b>Bot Shield обнаружил аномалию</b><small>Ночной трафик · 3 источника требуют проверки</small></div><span className="alert-count">3</span></div>
       </div>
      </div>
     </div>
     <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
    </div>
   </section>
   <section className="feature-section" id="platform">
    <div className="section-heading"><div><span className="eyebrow">ОДНА СИСТЕМА ВМЕСТО ДЕСЯТИ ВКЛАДОК</span><h2>Инструменты, которые<br/>работают вместе</h2></div><p>От сигнала в аналитике до задачи в спринте — без потери контекста и переключения между сервисами.</p></div>
    <div className="feature-grid">{features.map((f,i)=><article className="feature-card" key={f.title}><span className="feature-icon"><f.icon size={19} strokeWidth={1.6}/></span><span className="feature-index">0{i+1}</span><h3>{f.title}</h3><p>{f.text}</p><div className="feature-line"/></article>)}</div>
   </section>
   <section className="team-band" id="teams">
    <div><span className="eyebrow">ДЛЯ АГЕНТСТВ И IN-HOUSE</span><h2>Клиенты, команда и работа<br/>собраны в одном workspace</h2></div>
    <div className="team-points"><span><Check size={15}/> Отдельный проект на каждого клиента</span><span><Check size={15}/> Роли: owner, manager, specialist, viewer</span><span><Check size={15}/> Приоритеты, сроки и канбан-поток</span></div>
    <Link to="/register" className="btn btn-primary">Создать workspace <ArrowRight size={15}/></Link>
   </section>
  </main>
  <footer className="landing-footer"><Link to="/" className="brand"><span className="brand-mark"><Activity size={17}/></span><span>AI <b>MARKETER</b></span></Link><span>Маркетинговые решения — в одном рабочем пространстве.</span><span>© 2026 AI Marketer</span></footer>
 </div>
}