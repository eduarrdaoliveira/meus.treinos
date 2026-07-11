import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Calculator, CalendarDays, ChevronLeft, ChevronRight, Dumbbell, History, Layers3, LogOut, Pencil, Plus, Save, Trash2, TrendingUp, UserRound, X } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';

type Exercise={id:string;name:string;group:string;equipment:string;notes:string};
type Template={id:string;name:string;exerciseIds:string[]};
type SetRow={weight:string;reps:string;done:boolean};
type WorkoutItem={exerciseId:string;sets:SetRow[];notes:string};
type Workout={id:string;date:string;templateName:string;notes:string;items:WorkoutItem[];createdAt?:unknown};
type Schedule={id:string;templateId:string;weekdays:number[];startDate:string;weeks:number};

type Tab='today'|'exercises'|'templates'|'history'|'calendar';
const groups=['Glúteos','Quadríceps','Posterior','Panturrilhas','Costas','Peito','Ombros','Bíceps','Tríceps','Core'];
const emptySet=():SetRow=>({weight:'',reps:'',done:false});
const today=()=>new Date().toISOString().slice(0,10);
const weekdayLabels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const commonPlates=[1.25,2.5,5,10,15,20,25];

function fmtLong(dateStr:string){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(dateStr+'T12:00:00'));}
function toISO(d:Date){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dd}`;}
function monthMatrix(year:number,month:number){
 const first=new Date(year,month,1);
 const startWeekday=first.getDay();
 const daysInMonth=new Date(year,month+1,0).getDate();
 const cells:(Date|null)[]=[];
 for(let i=0;i<startWeekday;i++)cells.push(null);
 for(let d=1;d<=daysInMonth;d++)cells.push(new Date(year,month,d));
 while(cells.length%7!==0)cells.push(null);
 return cells;
}
function isScheduledOn(s:Schedule,d:Date){
 const start=new Date(s.startDate+'T00:00:00');
 const diffDays=Math.floor((d.getTime()-new Date(start.getFullYear(),start.getMonth(),start.getDate()).getTime())/86400000);
 if(diffDays<0||diffDays>=s.weeks*7)return false;
 return s.weekdays.includes(d.getDay());
}

export default function App(){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[tab,setTab]=useState<Tab>('today');
 const [exercises,setExercises]=useState<Exercise[]>([]),[templates,setTemplates]=useState<Template[]>([]),[workouts,setWorkouts]=useState<Workout[]>([]),[schedules,setSchedules]=useState<Schedule[]>([]);
 const [exerciseForm,setExerciseForm]=useState({id:'',name:'',group:'Glúteos',equipment:'',notes:''});
 const [templateForm,setTemplateForm]=useState({id:'',name:'',exerciseIds:[] as string[]});
 const [selectedTemplate,setSelectedTemplate]=useState('');
 const [activeItems,setActiveItems]=useState<WorkoutItem[]>([]),[workoutNotes,setWorkoutNotes]=useState('');
 const [workoutDate,setWorkoutDate]=useState(today());
 const [editingDateId,setEditingDateId]=useState<string|null>(null);
 const [calc,setCalc]=useState<{key:string;bar:string;plate:string;count:string}|null>(null);
 const [historyView,setHistoryView]=useState<'lista'|'evolucao'>('lista');
 const [evoExercise,setEvoExercise]=useState('');
 const [calMonth,setCalMonth]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
 const [scheduleForm,setScheduleForm]=useState({templateId:'',weekdays:[] as number[],startDate:today(),weeks:8});
 const [selectedDay,setSelectedDay]=useState<string|null>(null);

 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)}),[]);
 useEffect(()=>{if(!user)return; const base=`users/${user.uid}`;
  const u1=onSnapshot(query(collection(db,base,'exercises'),orderBy('name')),s=>setExercises(s.docs.map(d=>({id:d.id,...d.data()} as Exercise))));
  const u2=onSnapshot(query(collection(db,base,'templates'),orderBy('name')),s=>setTemplates(s.docs.map(d=>({id:d.id,...d.data()} as Template))));
  const u3=onSnapshot(query(collection(db,base,'workouts'),orderBy('date','desc')),s=>setWorkouts(s.docs.map(d=>({id:d.id,...d.data()} as Workout))));
  const u4=onSnapshot(collection(db,base,'schedules'),s=>setSchedules(s.docs.map(d=>({id:d.id,...d.data()} as Schedule))));
  return()=>{u1();u2();u3();u4()};
 },[user]);

 const stats=useMemo(()=>{const sets=activeItems.flatMap(i=>i.sets);return{exercises:activeItems.length,sets:sets.length,volume:sets.reduce((a,s)=>a+(+s.weight||0)*(+s.reps||0),0)}},[activeItems]);
 if(loading)return <div className="center">Carregando…</div>;
 if(!user)return <Login/>;
 const base=`users/${user.uid}`;

 async function saveExercise(){if(!exerciseForm.name.trim())return alert('Digite o nome do exercício.'); const data={name:exerciseForm.name.trim(),group:exerciseForm.group,equipment:exerciseForm.equipment.trim(),notes:exerciseForm.notes.trim()}; if(exerciseForm.id)await updateDoc(doc(db,base,'exercises',exerciseForm.id),data);else await addDoc(collection(db,base,'exercises'),data);setExerciseForm({id:'',name:'',group:'Glúteos',equipment:'',notes:''});}
 async function saveTemplate(){if(!templateForm.name.trim()||!templateForm.exerciseIds.length)return alert('Informe o nome e selecione exercícios.'); const data={name:templateForm.name.trim(),exerciseIds:templateForm.exerciseIds}; if(templateForm.id)await updateDoc(doc(db,base,'templates',templateForm.id),data);else await addDoc(collection(db,base,'templates'),data);setTemplateForm({id:'',name:'',exerciseIds:[]});}
 function loadTemplate(id:string){const t=templates.find(x=>x.id===id);if(!t)return;setSelectedTemplate(id);setActiveItems(t.exerciseIds.map(exerciseId=>({exerciseId,notes:'',sets:[emptySet(),emptySet(),emptySet()]})));}
 function addExerciseToToday(id:string){setActiveItems(v=>[...v,{exerciseId:id,notes:'',sets:[emptySet(),emptySet(),emptySet()]}]);}
 function updateSet(i:number,j:number,key:keyof SetRow,value:string|boolean){setActiveItems(v=>v.map((item,ii)=>ii===i?{...item,sets:item.sets.map((s,jj)=>jj===j?{...s,[key]:value}:s)}:item));}
 async function finishWorkout(){if(!activeItems.length)return alert('Adicione ao menos um exercício.');const t=templates.find(x=>x.id===selectedTemplate);await addDoc(collection(db,base,'workouts'),{date:workoutDate,templateName:t?.name||'Treino livre',notes:workoutNotes,items:activeItems,createdAt:serverTimestamp()});setActiveItems([]);setWorkoutNotes('');setSelectedTemplate('');setWorkoutDate(today());setTab('history');}
 async function updateWorkoutDate(id:string,newDate:string){await updateDoc(doc(db,base,'workouts',id),{date:newDate});setEditingDateId(null);}

 function applyPlateCalc(i:number,j:number){if(!calc)return;const bar=+calc.bar||0,plate=+calc.plate||0,count=+calc.count||0;const total=bar+plate*2*count;updateSet(i,j,'weight',String(total));setCalc(null);}

 async function saveSchedule(){if(!scheduleForm.templateId||!scheduleForm.weekdays.length)return alert('Escolha um modelo e ao menos um dia da semana.');await addDoc(collection(db,base,'schedules'),{templateId:scheduleForm.templateId,weekdays:scheduleForm.weekdays,startDate:scheduleForm.startDate,weeks:scheduleForm.weeks});setScheduleForm({templateId:'',weekdays:[],startDate:today(),weeks:8});}
 function startScheduledWorkout(dateStr:string,templateId:string){loadTemplate(templateId);setWorkoutDate(dateStr);setTab('today');}

 const completedDates=useMemo(()=>new Set(workouts.map(w=>w.date)),[workouts]);
 const cells=monthMatrix(calMonth.y,calMonth.m);

 return <div className="app">
  <header><div><span className="kicker">MEUS.TREINOS</span><h1>Olá, {user.displayName?.split(' ')[0]||'Eduarda'}</h1></div><button className="ghost" onClick={()=>signOut(auth)}><LogOut size={18}/> Sair</button></header>
  <nav>{([['today',Dumbbell,'Hoje'],['exercises',Layers3,'Exercícios'],['templates',Plus,'Modelos'],['history',History,'Histórico'],['calendar',CalendarDays,'Calendário']] as const).map(([id,Icon,label])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><Icon size={18}/>{label}</button>)}</nav>

  {tab==='today'&&<main>
   <section className="hero"><div><span className="kicker">TREINO</span><h2>Registrar treino</h2><p>Carregue um modelo ou monte livremente. Você pode escolher a data.</p></div>
    <div className="row"><input type="date" value={workoutDate} onChange={e=>setWorkoutDate(e.target.value)}/><select value={selectedTemplate} onChange={e=>loadTemplate(e.target.value)}><option value="">Escolher modelo</option>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button onClick={finishWorkout}><Save size={18}/> Concluir treino</button></div></section>
   <div className="summary"><div><b>{stats.exercises}</b><span>exercícios</span></div><div><b>{stats.sets}</b><span>séries</span></div><div><b>{Math.round(stats.volume).toLocaleString('pt-BR')} kg</b><span>volume</span></div></div>
   <section className="panel"><div className="panelHead"><h3>Exercícios</h3><select onChange={e=>{if(e.target.value)addExerciseToToday(e.target.value);e.target.value=''}}><option value="">+ Adicionar exercício</option>{exercises.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
    {!activeItems.length?<div className="empty">Nenhum exercício selecionado.</div>:activeItems.map((item,i)=>{const ex=exercises.find(e=>e.id===item.exerciseId);return <article className="workoutCard" key={`${item.exerciseId}-${i}`}><div className="cardHead"><div><h3>{ex?.name||'Exercício'}</h3><span>{ex?.group}</span></div><button className="danger icon" onClick={()=>setActiveItems(v=>v.filter((_,ii)=>ii!==i))}><Trash2 size={17}/></button></div>
      <div className="setHeader"><span>#</span><span>Peso (kg)</span><span></span><span>Reps</span><span>Feita</span></div>
      {item.sets.map((s,j)=>{const key=`${i}-${j}`;return <div key={j}>
        <div className="setRow">
          <span>{j+1}</span>
          <input type="number" value={s.weight} onChange={e=>updateSet(i,j,'weight',e.target.value)}/>
          <button type="button" className="ghost icon platesBtn" title="Calcular por placas" onClick={()=>setCalc(calc?.key===key?null:{key,bar:'20',plate:'20',count:''})}><Calculator size={15}/></button>
          <input type="number" value={s.reps} onChange={e=>updateSet(i,j,'reps',e.target.value)}/>
          <input type="checkbox" checked={s.done} onChange={e=>updateSet(i,j,'done',e.target.checked)}/>
        </div>
        {calc?.key===key&&<div className="plateCalc">
          <label>Barra (kg)<input type="number" value={calc.bar} onChange={e=>setCalc({...calc,bar:e.target.value})}/></label>
          <label>Placa (kg)<select value={calc.plate} onChange={e=>setCalc({...calc,plate:e.target.value})}>{commonPlates.map(p=><option key={p} value={p}>{p}</option>)}</select></label>
          <label>Placas por lado<input type="number" value={calc.count} onChange={e=>setCalc({...calc,count:e.target.value})}/></label>
          <div className="row"><button type="button" onClick={()=>applyPlateCalc(i,j)}>Aplicar</button><button type="button" className="secondary" onClick={()=>setCalc(null)}><X size={15}/></button></div>
        </div>}
      </div>})}
      <div className="row"><button className="secondary" onClick={()=>setActiveItems(v=>v.map((x,ii)=>ii===i?{...x,sets:[...x.sets,emptySet()]}:x))}>+ Série</button><input className="grow" placeholder="Observação do exercício" value={item.notes} onChange={e=>setActiveItems(v=>v.map((x,ii)=>ii===i?{...x,notes:e.target.value}:x))}/></div></article>})}
    <textarea placeholder="Observação geral do treino" value={workoutNotes} onChange={e=>setWorkoutNotes(e.target.value)}/>
   </section>
  </main>}

  {tab==='exercises'&&<main className="grid2"><section className="panel"><h2>{exerciseForm.id?'Editar exercício':'Novo exercício'}</h2><label>Nome<input value={exerciseForm.name} onChange={e=>setExerciseForm({...exerciseForm,name:e.target.value})}/></label><label>Grupo<select value={exerciseForm.group} onChange={e=>setExerciseForm({...exerciseForm,group:e.target.value})}>{groups.map(g=><option key={g}>{g}</option>)}</select></label><label>Equipamento<input value={exerciseForm.equipment} onChange={e=>setExerciseForm({...exerciseForm,equipment:e.target.value})}/></label><label>Observações<textarea value={exerciseForm.notes} onChange={e=>setExerciseForm({...exerciseForm,notes:e.target.value})}/></label><button onClick={saveExercise}><Save size={18}/> Salvar</button></section><section><h2>Biblioteca</h2><div className="cards">{exercises.map(e=><article className="mini" key={e.id}><span className="pill">{e.group}</span><h3>{e.name}</h3><p>{e.equipment}</p><div className="row"><button className="secondary" onClick={()=>setExerciseForm(e)}>Editar</button><button className="danger" onClick={()=>confirm('Excluir exercício?')&&deleteDoc(doc(db,base,'exercises',e.id))}>Excluir</button></div></article>)}</div></section></main>}

  {tab==='templates'&&<main className="grid2"><section className="panel"><h2>{templateForm.id?'Editar modelo':'Novo modelo'}</h2><label>Nome<input value={templateForm.name} onChange={e=>setTemplateForm({...templateForm,name:e.target.value})}/></label><div className="checks">{exercises.map(e=><label key={e.id}><input type="checkbox" checked={templateForm.exerciseIds.includes(e.id)} onChange={()=>setTemplateForm(f=>({...f,exerciseIds:f.exerciseIds.includes(e.id)?f.exerciseIds.filter(x=>x!==e.id):[...f.exerciseIds,e.id]}))}/>{e.name}</label>)}</div><button onClick={saveTemplate}><Save size={18}/> Salvar modelo</button></section><section><h2>Modelos</h2><div className="cards">{templates.map(t=><article className="mini" key={t.id}><span className="pill">{t.exerciseIds.length} exercícios</span><h3>{t.name}</h3><p>{t.exerciseIds.map(id=>exercises.find(e=>e.id===id)?.name).filter(Boolean).join(' · ')}</p><div className="row"><button onClick={()=>{setTemplateForm(t);scrollTo(0,0)}}>Editar</button><button className="danger" onClick={()=>confirm('Excluir modelo?')&&deleteDoc(doc(db,base,'templates',t.id))}>Excluir</button></div></article>)}</div></section></main>}

  {tab==='history'&&<main>
   <section className="hero"><div><span className="kicker">EVOLUÇÃO</span><h2>Histórico</h2><p>Treinos concluídos e séries registradas.</p></div>
    <div className="row"><nav className="subNav"><button className={historyView==='lista'?'active':''} onClick={()=>setHistoryView('lista')}><History size={16}/>Lista</button><button className={historyView==='evolucao'?'active':''} onClick={()=>setHistoryView('evolucao')}><TrendingUp size={16}/>Evolução</button></nav></div>
   </section>

   {historyView==='lista'&&<div className="history">{!workouts.length?<div className="empty">Nenhum treino concluído.</div>:workouts.map(w=><article className="panel" key={w.id}><div className="panelHead"><div><h3>{w.templateName}</h3>
     {editingDateId===w.id?<input type="date" value={w.date} onChange={e=>updateWorkoutDate(w.id,e.target.value)} onBlur={()=>setEditingDateId(null)} autoFocus/>:<span>{fmtLong(w.date)} <button className="ghost icon" onClick={()=>setEditingDateId(w.id)}><Pencil size={13}/></button></span>}
    </div><button className="danger icon" onClick={()=>confirm('Excluir treino?')&&deleteDoc(doc(db,base,'workouts',w.id))}><Trash2 size={17}/></button></div>{w.items.map((it,i)=>{const ex=exercises.find(e=>e.id===it.exerciseId);return <div className="historyRow" key={i}><b>{ex?.name||'Exercício'}</b><span>{it.sets.filter(s=>s.weight||s.reps).map(s=>`${s.weight||0} kg × ${s.reps||0}`).join(' · ')}</span>{it.notes&&<small>{it.notes}</small>}</div>})}{w.notes&&<p>{w.notes}</p>}</article>)}</div>}

   {historyView==='evolucao'&&<section className="panel">
    <div className="panelHead"><h3>Evolução por exercício</h3><select value={evoExercise} onChange={e=>setEvoExercise(e.target.value)}><option value="">Escolher exercício</option>{exercises.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
    {!evoExercise?<div className="empty">Escolha um exercício para ver a evolução.</div>:<EvolutionChart workouts={workouts} exerciseId={evoExercise}/>}
   </section>}
  </main>}

  {tab==='calendar'&&<main>
   <section className="hero"><div><span className="kicker">PLANEJAMENTO</span><h2>Calendário</h2><p>Programe treinos recorrentes e acompanhe sua frequência.</p></div></section>

   <section className="panel">
    <div className="panelHead">
     <button className="ghost icon" onClick={()=>setCalMonth(v=>{const m=v.m-1;return m<0?{y:v.y-1,m:11}:{y:v.y,m}})}><ChevronLeft size={18}/></button>
     <h3>{new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(calMonth.y,calMonth.m,1))}</h3>
     <button className="ghost icon" onClick={()=>setCalMonth(v=>{const m=v.m+1;return m>11?{y:v.y+1,m:0}:{y:v.y,m}})}><ChevronRight size={18}/></button>
    </div>
    <div className="calendarGrid">
     {weekdayLabels.map(d=><div className="calWeekday" key={d}>{d}</div>)}
     {cells.map((d,i)=>{
      if(!d)return <div className="calCell calEmpty" key={i}/>;
      const iso=toISO(d);
      const done=completedDates.has(iso);
      const scheduledHere=schedules.filter(s=>isScheduledOn(s,d));
      const isToday=iso===today();
      return <button key={i} className={`calCell${done?' calDone':''}${scheduledHere.length?' calScheduled':''}${isToday?' calToday':''}${selectedDay===iso?' calSelected':''}`} onClick={()=>setSelectedDay(iso===selectedDay?null:iso)}>
       <span>{d.getDate()}</span>
      </button>;
     })}
    </div>
    <div className="calLegend"><span><i className="dotDone"/> treino feito</span><span><i className="dotSched"/> agendado</span></div>

    {selectedDay&&<div className="dayDetail">
     <b>{fmtLong(selectedDay)}</b>
     {completedDates.has(selectedDay)&&<p>Treino já registrado nesse dia. Veja no histórico.</p>}
     {schedules.filter(s=>isScheduledOn(s,new Date(selectedDay+'T12:00:00'))).map(s=>{const t=templates.find(x=>x.id===s.templateId);return <div className="row" key={s.id}><span>{t?.name||'Modelo'}</span>{!completedDates.has(selectedDay)&&<button onClick={()=>startScheduledWorkout(selectedDay,s.templateId)}>Iniciar treino</button>}</div>})}
     {!schedules.some(s=>isScheduledOn(s,new Date(selectedDay+'T12:00:00')))&&!completedDates.has(selectedDay)&&<p className="empty">Nada programado para esse dia.</p>}
    </div>}
   </section>

   <section className="panel">
    <h3>Agendar treino recorrente</h3>
    <label>Modelo<select value={scheduleForm.templateId} onChange={e=>setScheduleForm({...scheduleForm,templateId:e.target.value})}><option value="">Escolher modelo</option>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
    <label>Dias da semana<div className="weekdayPicker">{weekdayLabels.map((d,idx)=><button type="button" key={d} className={scheduleForm.weekdays.includes(idx)?'active':''} onClick={()=>setScheduleForm(f=>({...f,weekdays:f.weekdays.includes(idx)?f.weekdays.filter(x=>x!==idx):[...f.weekdays,idx]}))}>{d}</button>)}</div></label>
    <div className="row">
     <label>A partir de<input type="date" value={scheduleForm.startDate} onChange={e=>setScheduleForm({...scheduleForm,startDate:e.target.value})}/></label>
     <label>Repetir por (semanas)<input type="number" min={1} value={scheduleForm.weeks} onChange={e=>setScheduleForm({...scheduleForm,weeks:+e.target.value||1})}/></label>
    </div>
    <button onClick={saveSchedule}><Save size={18}/> Salvar agendamento</button>

    {schedules.length>0&&<div className="cards" style={{marginTop:16}}>{schedules.map(s=>{const t=templates.find(x=>x.id===s.templateId);return <article className="mini" key={s.id}><span className="pill">{s.weekdays.map(w=>weekdayLabels[w]).join(', ')}</span><h3>{t?.name||'Modelo'}</h3><p>A partir de {fmtLong(s.startDate)} · {s.weeks} semanas</p><button className="danger" onClick={()=>confirm('Excluir agendamento?')&&deleteDoc(doc(db,base,'schedules',s.id))}>Excluir</button></article>})}</div>}
   </section>
  </main>}
 </div>
}

function EvolutionChart({workouts,exerciseId}:{workouts:Workout[];exerciseId:string}){
 const data=useMemo(()=>workouts
  .map(w=>{const it=w.items.find(i=>i.exerciseId===exerciseId);if(!it)return null;const maxWeight=Math.max(0,...it.sets.map(s=>+s.weight||0));return{date:w.date,maxWeight};})
  .filter((x):x is{date:string;maxWeight:number}=>!!x&&x.maxWeight>0)
  .sort((a,b)=>a.date.localeCompare(b.date)),[workouts,exerciseId]);

 if(!data.length)return <div className="empty">Nenhum registro de peso ainda para este exercício.</div>;
 const max=Math.max(...data.map(d=>d.maxWeight),1);
 const w=Math.max(320,data.length*56),h=200,padB=28,padT=12;
 return <div className="evoChartWrap">
  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
   {data.map((d,i)=>{const barH=((d.maxWeight/max)*(h-padB-padT));const x=i*56+14,y=h-padB-barH;
    return <g key={d.date}>
     <rect x={x} y={y} width={28} height={barH} rx={6} fill="#008B8B"/>
     <text x={x+14} y={y-6} textAnchor="middle" fontSize="11" fill="#1C1C1E">{d.maxWeight}</text>
     <text x={x+14} y={h-10} textAnchor="middle" fontSize="10" fill="#6E6E73">{d.date.slice(5).split('-').reverse().join('/')}</text>
    </g>;})}
  </svg>
 </div>;
}

function Login(){return <div className="login"><div className="loginCard"><div className="logo"><Dumbbell/></div><span className="kicker">MEUS.TREINOS</span><h1>Seu diário de treino</h1><p>Organize exercícios, modelos, séries e histórico em um só lugar.</p><button onClick={()=>signInWithPopup(auth,googleProvider)}><UserRound size={19}/> Entrar com Google</button></div></div>}
