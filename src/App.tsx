import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CalendarDays, ChevronLeft, ChevronRight, Dumbbell, Layers3, LogOut, Pencil, Plus, Save, Trash2, TrendingUp, UserRound } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';

type Exercise={id:string;name:string;group:string;equipment:string;notes:string};
type Template={id:string;name:string;exerciseIds:string[]};
type SetRow={weight:string;reps:string;done:boolean;unit:'kg'|'placas'};
type WorkoutItem={exerciseId:string;sets:SetRow[];notes:string};
type Workout={id:string;date:string;templateName:string;notes:string;items:WorkoutItem[];createdAt?:unknown};
type Schedule={id:string;templateId:string;weekdays:number[];startDate:string;weeks:number};

type Tab='today'|'exercises'|'templates'|'calendar'|'evolution';
type CalView='month'|'schedule';
const groups=['Glúteos','Quadríceps','Posterior','Panturrilhas','Costas','Peito','Ombros','Bíceps','Tríceps','Core'];
const emptySet=():SetRow=>({weight:'',reps:'',done:false,unit:'kg'});
const today=()=>new Date().toISOString().slice(0,10);
const weekdayLabels=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtLong(dateStr:string){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(dateStr+'T12:00:00'));}
function toISO(d:Date){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dd}`;}
function workoutVolume(w:Workout){return w.items.flatMap(i=>i.sets).reduce((a,s)=>a+(+s.weight||0)*(+s.reps||0),0);}
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

function SetTable({sets,onChange}:{sets:SetRow[];onChange:(j:number,key:keyof SetRow,value:string|boolean)=>void}){
 return <>
  <div className="setHeader"><span>#</span><span>Peso</span><span>Un.</span><span>Reps</span><span>Feita</span></div>
  {sets.map((s,j)=><div className="setRow" key={j}>
    <span>{j+1}</span>
    <input type="number" value={s.weight} onChange={e=>onChange(j,'weight',e.target.value)}/>
    <div className="unitToggle">
     <button type="button" className={s.unit!=='placas'?'active':''} onClick={()=>onChange(j,'unit','kg')}>kg</button>
     <button type="button" className={s.unit==='placas'?'active':''} onClick={()=>onChange(j,'unit','placas')}>pl</button>
    </div>
    <input type="number" value={s.reps} onChange={e=>onChange(j,'reps',e.target.value)}/>
    <input type="checkbox" checked={s.done} onChange={e=>onChange(j,'done',e.target.checked)}/>
  </div>)}
 </>;
}

export default function App(){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[tab,setTab]=useState<Tab>('today');
 const [exercises,setExercises]=useState<Exercise[]>([]),[templates,setTemplates]=useState<Template[]>([]),[workouts,setWorkouts]=useState<Workout[]>([]),[schedules,setSchedules]=useState<Schedule[]>([]);
 const [exerciseForm,setExerciseForm]=useState({id:'',name:'',group:'Glúteos',equipment:'',notes:''});
 const [templateForm,setTemplateForm]=useState({id:'',name:'',exerciseIds:[] as string[]});
 const [selectedTemplate,setSelectedTemplate]=useState('');
 const [activeItems,setActiveItems]=useState<WorkoutItem[]>([]),[workoutNotes,setWorkoutNotes]=useState('');
 const [workoutDate,setWorkoutDate]=useState(today());
 const [evoExercise,setEvoExercise]=useState('');
 const [calMonth,setCalMonth]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
 const [calView,setCalView]=useState<CalView>('month');
 const [scheduleForm,setScheduleForm]=useState({templateId:'',weekdays:[] as number[],startDate:today(),weeks:8});
 const [selectedDay,setSelectedDay]=useState<string|null>(null);
 const [editingSelectedDate,setEditingSelectedDate]=useState(false);

 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)}),[]);
 useEffect(()=>{if(!user)return; const base=`users/${user.uid}`;
  const u1=onSnapshot(query(collection(db,base,'exercises'),orderBy('name')),s=>setExercises(s.docs.map(d=>({id:d.id,...d.data()} as Exercise))));
  const u2=onSnapshot(query(collection(db,base,'templates'),orderBy('name')),s=>setTemplates(s.docs.map(d=>({id:d.id,...d.data()} as Template))));
  const u3=onSnapshot(query(collection(db,base,'workouts'),orderBy('date','desc')),s=>setWorkouts(s.docs.map(d=>({id:d.id,...d.data()} as Workout))));
  const u4=onSnapshot(collection(db,base,'schedules'),s=>setSchedules(s.docs.map(d=>({id:d.id,...d.data()} as Schedule))));
  return()=>{u1();u2();u3();u4()};
 },[user]);

 const stats=useMemo(()=>{const sets=activeItems.flatMap(i=>i.sets);return{exercises:activeItems.length,sets:sets.length,volume:sets.reduce((a,s)=>a+(+s.weight||0)*(+s.reps||0),0)}},[activeItems]);
 const completedDates=useMemo(()=>new Set(workouts.map(w=>w.date)),[workouts]);
 if(loading)return <div className="center">Carregando…</div>;
 if(!user)return <Login/>;
 const base=`users/${user.uid}`;

 async function saveExercise(){if(!exerciseForm.name.trim())return alert('Digite o nome do exercício.'); const data={name:exerciseForm.name.trim(),group:exerciseForm.group,equipment:exerciseForm.equipment.trim(),notes:exerciseForm.notes.trim()}; if(exerciseForm.id)await updateDoc(doc(db,base,'exercises',exerciseForm.id),data);else await addDoc(collection(db,base,'exercises'),data);setExerciseForm({id:'',name:'',group:'Glúteos',equipment:'',notes:''});}
 async function saveTemplate(){if(!templateForm.name.trim()||!templateForm.exerciseIds.length)return alert('Informe o nome e selecione exercícios.'); const data={name:templateForm.name.trim(),exerciseIds:templateForm.exerciseIds}; if(templateForm.id)await updateDoc(doc(db,base,'templates',templateForm.id),data);else await addDoc(collection(db,base,'templates'),data);setTemplateForm({id:'',name:'',exerciseIds:[]});}
 function loadTemplate(id:string){const t=templates.find(x=>x.id===id);if(!t)return;setSelectedTemplate(id);setActiveItems(t.exerciseIds.map(exerciseId=>({exerciseId,notes:'',sets:[emptySet(),emptySet(),emptySet()]})));}
 function addExerciseToToday(id:string){setActiveItems(v=>[...v,{exerciseId:id,notes:'',sets:[emptySet(),emptySet(),emptySet()]}]);}
 function updateSet(i:number,j:number,key:keyof SetRow,value:string|boolean){setActiveItems(v=>v.map((item,ii)=>ii===i?{...item,sets:item.sets.map((s,jj)=>jj===j?{...s,[key]:value}:s)}:item));}
 async function finishWorkout(){if(!activeItems.length)return alert('Adicione ao menos um exercício.');const t=templates.find(x=>x.id===selectedTemplate);await addDoc(collection(db,base,'workouts'),{date:workoutDate,templateName:t?.name||'Treino livre',notes:workoutNotes,items:activeItems,createdAt:serverTimestamp()});setActiveItems([]);setWorkoutNotes('');setSelectedTemplate('');setWorkoutDate(today());setSelectedDay(null);}

 async function saveSchedule(){if(!scheduleForm.templateId||!scheduleForm.weekdays.length)return alert('Escolha um modelo e ao menos um dia da semana.');await addDoc(collection(db,base,'schedules'),{templateId:scheduleForm.templateId,weekdays:scheduleForm.weekdays,startDate:scheduleForm.startDate,weeks:scheduleForm.weeks});setScheduleForm({templateId:'',weekdays:[],startDate:today(),weeks:8});}
 function startScheduledWorkout(dateStr:string,templateId:string){loadTemplate(templateId);setWorkoutDate(dateStr);setTab('today');}
 function startFreeWorkoutOn(dateStr:string){setSelectedTemplate('');setActiveItems([]);setWorkoutDate(dateStr);setTab('today');}

 async function patchWorkoutItems(workoutId:string,updater:(items:WorkoutItem[])=>WorkoutItem[]){const w=workouts.find(x=>x.id===workoutId);if(!w)return;await updateDoc(doc(db,base,'workouts',workoutId),{items:updater(w.items)});}
 function updateWorkoutSet(workoutId:string,i:number,j:number,key:keyof SetRow,value:string|boolean){patchWorkoutItems(workoutId,items=>items.map((it,ii)=>ii===i?{...it,sets:it.sets.map((s,jj)=>jj===j?{...s,[key]:value}:s)}:it));}
 function addSetToWorkoutItem(workoutId:string,i:number){patchWorkoutItems(workoutId,items=>items.map((it,ii)=>ii===i?{...it,sets:[...it.sets,emptySet()]}:it));}
 function removeWorkoutItem(workoutId:string,i:number){patchWorkoutItems(workoutId,items=>items.filter((_,ii)=>ii!==i));}
 function addExerciseToWorkout(workoutId:string,exerciseId:string){patchWorkoutItems(workoutId,items=>[...items,{exerciseId,notes:'',sets:[emptySet(),emptySet(),emptySet()]}]);}
 function updateWorkoutItemNotes(workoutId:string,i:number,value:string){patchWorkoutItems(workoutId,items=>items.map((it,ii)=>ii===i?{...it,notes:value}:it));}
 async function updateWorkoutDate(workoutId:string,newDate:string){await updateDoc(doc(db,base,'workouts',workoutId),{date:newDate});setSelectedDay(newDate);setEditingSelectedDate(false);}
 async function updateWorkoutNotes(workoutId:string,value:string){await updateDoc(doc(db,base,'workouts',workoutId),{notes:value});}

 const cells=monthMatrix(calMonth.y,calMonth.m);
 const selectedWorkout=selectedDay?workouts.find(w=>w.date===selectedDay):undefined;

 return <div className="app">
  <header><div><span className="kicker">MEUS.TREINOS</span><h1>Olá, {user.displayName?.split(' ')[0]||'Eduarda'}</h1></div><button className="ghost" onClick={()=>signOut(auth)}><LogOut size={18}/> Sair</button></header>
  <nav>{([['today',Dumbbell,'Hoje'],['exercises',Layers3,'Exercícios'],['templates',Plus,'Modelos'],['calendar',CalendarDays,'Calendário'],['evolution',TrendingUp,'Evolução']] as const).map(([id,Icon,label])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><Icon size={18}/>{label}</button>)}</nav>

  {tab==='today'&&<main>
   <section className="hero"><div><span className="kicker">TREINO</span><h2>Registrar treino</h2><p>Carregue um modelo ou monte livremente. Você pode escolher a data.</p></div>
    <div className="row"><input type="date" value={workoutDate} onChange={e=>setWorkoutDate(e.target.value)}/><select value={selectedTemplate} onChange={e=>loadTemplate(e.target.value)}><option value="">Escolher modelo</option>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button onClick={finishWorkout}><Save size={18}/> Concluir treino</button></div></section>
   <div className="summary"><div><b>{stats.exercises}</b><span>exercícios</span></div><div><b>{stats.sets}</b><span>séries</span></div><div><b>{Math.round(stats.volume).toLocaleString('pt-BR')} kg</b><span>volume</span></div></div>
   <section className="panel"><div className="panelHead"><h3>Exercícios</h3><select onChange={e=>{if(e.target.value)addExerciseToToday(e.target.value);e.target.value=''}}><option value="">+ Adicionar exercício</option>{exercises.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
    {!activeItems.length?<div className="empty">Nenhum exercício selecionado.</div>:activeItems.map((item,i)=>{const ex=exercises.find(e=>e.id===item.exerciseId);return <article className="workoutCard" key={`${item.exerciseId}-${i}`}><div className="cardHead"><div><h3>{ex?.name||'Exercício'}</h3><span>{ex?.group}</span></div><button className="danger icon" onClick={()=>setActiveItems(v=>v.filter((_,ii)=>ii!==i))}><Trash2 size={17}/></button></div>
      <SetTable sets={item.sets} onChange={(j,key,value)=>updateSet(i,j,key,value)}/>
      <div className="row"><button className="secondary" onClick={()=>setActiveItems(v=>v.map((x,ii)=>ii===i?{...x,sets:[...x.sets,emptySet()]}:x))}>+ Série</button><input className="grow" placeholder="Observação do exercício" value={item.notes} onChange={e=>setActiveItems(v=>v.map((x,ii)=>ii===i?{...x,notes:e.target.value}:x))}/></div></article>})}
    <textarea placeholder="Observação geral do treino" value={workoutNotes} onChange={e=>setWorkoutNotes(e.target.value)}/>
   </section>
  </main>}

  {tab==='exercises'&&<main className="grid2"><section className="panel"><h2>{exerciseForm.id?'Editar exercício':'Novo exercício'}</h2><label>Nome<input value={exerciseForm.name} onChange={e=>setExerciseForm({...exerciseForm,name:e.target.value})}/></label><label>Grupo<select value={exerciseForm.group} onChange={e=>setExerciseForm({...exerciseForm,group:e.target.value})}>{groups.map(g=><option key={g}>{g}</option>)}</select></label><label>Equipamento<input value={exerciseForm.equipment} onChange={e=>setExerciseForm({...exerciseForm,equipment:e.target.value})}/></label><label>Observações<textarea value={exerciseForm.notes} onChange={e=>setExerciseForm({...exerciseForm,notes:e.target.value})}/></label><button onClick={saveExercise}><Save size={18}/> Salvar</button></section><section><h2>Biblioteca</h2><div className="cards">{exercises.map(e=><article className="mini" key={e.id}><span className="pill">{e.group}</span><h3>{e.name}</h3><p>{e.equipment}</p><div className="row"><button className="secondary" onClick={()=>setExerciseForm(e)}>Editar</button><button className="danger" onClick={()=>confirm('Excluir exercício?')&&deleteDoc(doc(db,base,'exercises',e.id))}>Excluir</button></div></article>)}</div></section></main>}

  {tab==='templates'&&<main className="grid2"><section className="panel"><h2>{templateForm.id?'Editar modelo':'Novo modelo'}</h2><label>Nome<input value={templateForm.name} onChange={e=>setTemplateForm({...templateForm,name:e.target.value})}/></label><div className="checks">{exercises.map(e=><label key={e.id}><input type="checkbox" checked={templateForm.exerciseIds.includes(e.id)} onChange={()=>setTemplateForm(f=>({...f,exerciseIds:f.exerciseIds.includes(e.id)?f.exerciseIds.filter(x=>x!==e.id):[...f.exerciseIds,e.id]}))}/>{e.name}</label>)}</div><button onClick={saveTemplate}><Save size={18}/> Salvar modelo</button></section><section><h2>Modelos</h2><div className="cards">{templates.map(t=><article className="mini" key={t.id}><span className="pill">{t.exerciseIds.length} exercícios</span><h3>{t.name}</h3><p>{t.exerciseIds.map(id=>exercises.find(e=>e.id===id)?.name).filter(Boolean).join(' · ')}</p><div className="row"><button onClick={()=>{setTemplateForm(t);scrollTo(0,0)}}>Editar</button><button className="danger" onClick={()=>confirm('Excluir modelo?')&&deleteDoc(doc(db,base,'templates',t.id))}>Excluir</button></div></article>)}</div></section></main>}

  {tab==='calendar'&&calView==='month'&&<main>
   <section className="hero"><div><span className="kicker">PLANEJAMENTO</span><h2>Calendário</h2><p>Programe treinos recorrentes e acompanhe sua frequência.</p><button className="secondary" onClick={()=>setCalView('schedule')}><CalendarDays size={17}/> Agendar treino recorrente</button></div></section>

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
      return <button key={i} className={`calCell${done?' calDone':''}${scheduledHere.length&&!done?' calScheduled':''}${isToday?' calToday':''}${selectedDay===iso?' calSelected':''}`} onClick={()=>{setSelectedDay(iso===selectedDay?null:iso);setEditingSelectedDate(false)}}>
       <span>{d.getDate()}</span>
      </button>;
     })}
    </div>
    <div className="calLegend"><span><i className="dotDone"/> treino feito</span><span><i className="dotSched"/> agendado</span></div>

    {selectedDay&&<div className="dayDetail">
     {selectedWorkout?<>
      <div className="dayDetailHead">
       <div>
        {editingSelectedDate?<input type="date" value={selectedWorkout.date} onChange={e=>updateWorkoutDate(selectedWorkout.id,e.target.value)} autoFocus/>:<b>{fmtLong(selectedWorkout.date)} <button className="ghost icon" onClick={()=>setEditingSelectedDate(true)}><Pencil size={13}/></button></b>}
        <div><span className="pill">{selectedWorkout.templateName}</span> <span className="volumeTag">Volume: {Math.round(workoutVolume(selectedWorkout)).toLocaleString('pt-BR')} kg</span></div>
       </div>
       <button className="danger icon" onClick={()=>confirm('Excluir treino?')&&deleteDoc(doc(db,base,'workouts',selectedWorkout.id)).then(()=>setSelectedDay(null))}><Trash2 size={17}/></button>
      </div>

      <div className="panelHead"><h4>Exercícios</h4><select onChange={e=>{if(e.target.value)addExerciseToWorkout(selectedWorkout.id,e.target.value);e.target.value=''}}><option value="">+ Adicionar exercício</option>{exercises.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
      {selectedWorkout.items.map((item,i)=>{const ex=exercises.find(e=>e.id===item.exerciseId);return <article className="workoutCard" key={`${item.exerciseId}-${i}`}>
       <div className="cardHead"><div><h3>{ex?.name||'Exercício'}</h3><span>{ex?.group}</span></div><button className="danger icon" onClick={()=>removeWorkoutItem(selectedWorkout.id,i)}><Trash2 size={17}/></button></div>
       <SetTable sets={item.sets} onChange={(j,key,value)=>updateWorkoutSet(selectedWorkout.id,i,j,key,value)}/>
       <div className="row"><button className="secondary" onClick={()=>addSetToWorkoutItem(selectedWorkout.id,i)}>+ Série</button><input className="grow" placeholder="Observação do exercício" value={item.notes} onChange={e=>updateWorkoutItemNotes(selectedWorkout.id,i,e.target.value)}/></div>
      </article>})}
      <textarea placeholder="Observação geral do treino" value={selectedWorkout.notes} onChange={e=>updateWorkoutNotes(selectedWorkout.id,e.target.value)}/>
     </>:<>
      <b>{fmtLong(selectedDay)}</b>
      {schedules.filter(s=>isScheduledOn(s,new Date(selectedDay+'T12:00:00'))).map(s=>{const t=templates.find(x=>x.id===s.templateId);return <div className="row" key={s.id}><span>{t?.name||'Modelo'}</span><button onClick={()=>startScheduledWorkout(selectedDay,s.templateId)}>Iniciar treino</button></div>})}
      {!schedules.some(s=>isScheduledOn(s,new Date(selectedDay+'T12:00:00')))&&<div className="emptyDayActions"><p className="empty">Nada programado para esse dia.</p><button className="secondary" onClick={()=>startFreeWorkoutOn(selectedDay)}><Plus size={16}/> Registrar treino nesse dia</button></div>}
     </>}
    </div>}
   </section>
  </main>}

  {tab==='calendar'&&calView==='schedule'&&<main>
   <section className="hero"><div><button className="ghost backBtn" onClick={()=>setCalView('month')}><ChevronLeft size={18}/> Voltar ao calendário</button><h2>Agendar treino recorrente</h2><p>Escolha um modelo, os dias da semana e por quanto tempo repetir.</p></div></section>
   <section className="panel">
    <label>Modelo<select value={scheduleForm.templateId} onChange={e=>setScheduleForm({...scheduleForm,templateId:e.target.value})}><option value="">Escolher modelo</option>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
    <label>Dias da semana<div className="weekdayPicker">{weekdayLabels.map((d,idx)=><button type="button" key={d} className={scheduleForm.weekdays.includes(idx)?'active':''} onClick={()=>setScheduleForm(f=>({...f,weekdays:f.weekdays.includes(idx)?f.weekdays.filter(x=>x!==idx):[...f.weekdays,idx]}))}>{d}</button>)}</div></label>
    <div className="row">
     <label>A partir de<input type="date" value={scheduleForm.startDate} onChange={e=>setScheduleForm({...scheduleForm,startDate:e.target.value})}/></label>
     <label>Repetir por (semanas)<input type="number" min={1} value={scheduleForm.weeks} onChange={e=>setScheduleForm({...scheduleForm,weeks:+e.target.value||1})}/></label>
    </div>
    <button onClick={saveSchedule}><Save size={18}/> Salvar agendamento</button>
   </section>
   <section className="panel">
    <h3>Agendamentos criados</h3>
    {!schedules.length?<div className="empty">Nenhum agendamento ainda.</div>:<div className="cards">{schedules.map(s=>{const t=templates.find(x=>x.id===s.templateId);return <article className="mini" key={s.id}><span className="pill">{s.weekdays.map(w=>weekdayLabels[w]).join(', ')}</span><h3>{t?.name||'Modelo'}</h3><p>A partir de {fmtLong(s.startDate)} · {s.weeks} semanas</p><button className="danger" onClick={()=>confirm('Excluir agendamento?')&&deleteDoc(doc(db,base,'schedules',s.id))}>Excluir</button></article>})}</div>}
   </section>
  </main>}

  {tab==='evolution'&&<main>
   <section className="hero"><div><span className="kicker">EVOLUÇÃO</span><h2>Evolução por exercício</h2><p>Acompanhe o peso máximo alcançado em cada treino.</p></div></section>
   <section className="panel">
    <div className="panelHead"><h3>Exercício</h3><select value={evoExercise} onChange={e=>setEvoExercise(e.target.value)}><option value="">Escolher exercício</option>{exercises.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
    {!evoExercise?<div className="empty">Escolha um exercício para ver a evolução.</div>:<EvolutionChart workouts={workouts} exerciseId={evoExercise}/>}
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
 const chartH=260,padB=36,padT=28,padL=40,barW=40,gap=24;
 const plotH=chartH-padB-padT;
 const w=Math.max(380,padL+data.length*(barW+gap)+gap);
 const gridSteps=[0,0.25,0.5,0.75,1];
 return <div className="evoChartWrap">
  <svg width={w} height={chartH} viewBox={`0 0 ${w} ${chartH}`}>
   {gridSteps.map(g=>{const y=padT+plotH-(g*plotH);const val=Math.round(max*g);return <g key={g}>
     <line x1={padL} x2={w-8} y1={y} y2={y} stroke="#E5E5EA" strokeWidth={1} strokeDasharray="4 4"/>
     <text x={padL-8} y={y+4} textAnchor="end" fontSize="10" fill="#6E6E73">{val}</text>
    </g>;})}
   {data.map((d,i)=>{const barH=(d.maxWeight/max)*plotH;const x=padL+gap+i*(barW+gap);const y=padT+plotH-barH;
    return <g key={d.date}>
     <rect x={x} y={y} width={barW} height={barH} rx={8} fill="#008B8B"/>
     <text x={x+barW/2} y={y-10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1C1C1E">{d.maxWeight}kg</text>
     <text x={x+barW/2} y={chartH-14} textAnchor="middle" fontSize="11" fill="#6E6E73">{d.date.slice(5).split('-').reverse().join('/')}</text>
    </g>;})}
  </svg>
 </div>;
}

function Login(){return <div className="login"><div className="loginCard"><div className="logo"><Dumbbell/></div><span className="kicker">MEUS.TREINOS</span><h1>Seu diário de treino</h1><p>Organize exercícios, modelos, séries e histórico em um só lugar.</p><button onClick={()=>signInWithPopup(auth,googleProvider)}><UserRound size={19}/> Entrar com Google</button></div></div>}
