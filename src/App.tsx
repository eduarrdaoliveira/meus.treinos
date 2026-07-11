import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Dumbbell, History, Layers3, LogOut, Plus, Save, Trash2, UserRound } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';

type Exercise={id:string;name:string;group:string;equipment:string;notes:string};
type Template={id:string;name:string;exerciseIds:string[]};
type SetRow={weight:string;reps:string;done:boolean};
type WorkoutItem={exerciseId:string;sets:SetRow[];notes:string};
type Workout={id:string;date:string;templateName:string;notes:string;items:WorkoutItem[];createdAt?:unknown};

type Tab='today'|'exercises'|'templates'|'history';
const groups=['Glúteos','Quadríceps','Posterior','Panturrilhas','Costas','Peito','Ombros','Bíceps','Tríceps','Core'];
const emptySet=():SetRow=>({weight:'',reps:'',done:false});
const today=()=>new Date().toISOString().slice(0,10);

export default function App(){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[tab,setTab]=useState<Tab>('today');
 const [exercises,setExercises]=useState<Exercise[]>([]),[templates,setTemplates]=useState<Template[]>([]),[workouts,setWorkouts]=useState<Workout[]>([]);
 const [exerciseForm,setExerciseForm]=useState({id:'',name:'',group:'Glúteos',equipment:'',notes:''});
 const [templateForm,setTemplateForm]=useState({id:'',name:'',exerciseIds:[] as string[]});
 const [selectedTemplate,setSelectedTemplate]=useState('');
 const [activeItems,setActiveItems]=useState<WorkoutItem[]>([]),[workoutNotes,setWorkoutNotes]=useState('');

 useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setLoading(false)}),[]);
 useEffect(()=>{if(!user)return; const base=`users/${user.uid}`;
  const u1=onSnapshot(query(collection(db,base,'exercises'),orderBy('name')),s=>setExercises(s.docs.map(d=>({id:d.id,...d.data()} as Exercise))));
  const u2=onSnapshot(query(collection(db,base,'templates'),orderBy('name')),s=>setTemplates(s.docs.map(d=>({id:d.id,...d.data()} as Template))));
  const u3=onSnapshot(query(collection(db,base,'workouts'),orderBy('date','desc')),s=>setWorkouts(s.docs.map(d=>({id:d.id,...d.data()} as Workout))));
  return()=>{u1();u2();u3()};
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
 async function finishWorkout(){if(!activeItems.length)return alert('Adicione ao menos um exercício.');const t=templates.find(x=>x.id===selectedTemplate);await addDoc(collection(db,base,'workouts'),{date:today(),templateName:t?.name||'Treino livre',notes:workoutNotes,items:activeItems,createdAt:serverTimestamp()});setActiveItems([]);setWorkoutNotes('');setSelectedTemplate('');setTab('history');}

 return <div className="app">
  <header><div><span className="kicker">MEUS.TREINOS</span><h1>Olá, {user.displayName?.split(' ')[0]||'Eduarda'}</h1></div><button className="ghost" onClick={()=>signOut(auth)}><LogOut size={18}/> Sair</button></header>
  <nav>{([['today',Dumbbell,'Hoje'],['exercises',Layers3,'Exercícios'],['templates',Plus,'Modelos'],['history',History,'Histórico']] as const).map(([id,Icon,label])=><button className={tab===id?'active':''} onClick={()=>setTab(id)} key={id}><Icon size={18}/>{label}</button>)}</nav>

  {tab==='today'&&<main>
   <section className="hero"><div><span className="kicker">{new Intl.DateTimeFormat('pt-BR',{dateStyle:'full'}).format(new Date())}</span><h2>Treino de hoje</h2><p>Carregue um modelo ou monte livremente.</p></div><div className="row"><select value={selectedTemplate} onChange={e=>loadTemplate(e.target.value)}><option value="">Escolher modelo</option>{templates.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><button onClick={finishWorkout}><Save size={18}/> Concluir treino</button></div></section>
   <div className="summary"><div><b>{stats.exercises}</b><span>exercícios</span></div><div><b>{stats.sets}</b><span>séries</span></div><div><b>{Math.round(stats.volume).toLocaleString('pt-BR')} kg</b><span>volume</span></div></div>
   <section className="panel"><div className="panelHead"><h3>Exercícios</h3><select onChange={e=>{if(e.target.value)addExerciseToToday(e.target.value);e.target.value=''}}><option value="">+ Adicionar exercício</option>{exercises.map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select></div>
    {!activeItems.length?<div className="empty">Nenhum exercício selecionado.</div>:activeItems.map((item,i)=>{const ex=exercises.find(e=>e.id===item.exerciseId);return <article className="workoutCard" key={`${item.exerciseId}-${i}`}><div className="cardHead"><div><h3>{ex?.name||'Exercício'}</h3><span>{ex?.group}</span></div><button className="danger icon" onClick={()=>setActiveItems(v=>v.filter((_,ii)=>ii!==i))}><Trash2 size={17}/></button></div>
      <div className="setHeader"><span>#</span><span>Peso (kg)</span><span>Reps</span><span>Feita</span></div>{item.sets.map((s,j)=><div className="setRow" key={j}><span>{j+1}</span><input type="number" value={s.weight} onChange={e=>updateSet(i,j,'weight',e.target.value)}/><input type="number" value={s.reps} onChange={e=>updateSet(i,j,'reps',e.target.value)}/><input type="checkbox" checked={s.done} onChange={e=>updateSet(i,j,'done',e.target.checked)}/></div>)}
      <div className="row"><button className="secondary" onClick={()=>setActiveItems(v=>v.map((x,ii)=>ii===i?{...x,sets:[...x.sets,emptySet()]}:x))}>+ Série</button><input className="grow" placeholder="Observação do exercício" value={item.notes} onChange={e=>setActiveItems(v=>v.map((x,ii)=>ii===i?{...x,notes:e.target.value}:x))}/></div></article>})}
    <textarea placeholder="Observação geral do treino" value={workoutNotes} onChange={e=>setWorkoutNotes(e.target.value)}/>
   </section>
  </main>}

  {tab==='exercises'&&<main className="grid2"><section className="panel"><h2>{exerciseForm.id?'Editar exercício':'Novo exercício'}</h2><label>Nome<input value={exerciseForm.name} onChange={e=>setExerciseForm({...exerciseForm,name:e.target.value})}/></label><label>Grupo<select value={exerciseForm.group} onChange={e=>setExerciseForm({...exerciseForm,group:e.target.value})}>{groups.map(g=><option key={g}>{g}</option>)}</select></label><label>Equipamento<input value={exerciseForm.equipment} onChange={e=>setExerciseForm({...exerciseForm,equipment:e.target.value})}/></label><label>Observações<textarea value={exerciseForm.notes} onChange={e=>setExerciseForm({...exerciseForm,notes:e.target.value})}/></label><button onClick={saveExercise}><Save size={18}/> Salvar</button></section><section><h2>Biblioteca</h2><div className="cards">{exercises.map(e=><article className="mini" key={e.id}><span className="pill">{e.group}</span><h3>{e.name}</h3><p>{e.equipment||'Sem equipamento'}</p><div className="row"><button className="secondary" onClick={()=>setExerciseForm(e)}>Editar</button><button className="danger" onClick={()=>confirm('Excluir exercício?')&&deleteDoc(doc(db,base,'exercises',e.id))}>Excluir</button></div></article>)}</div></section></main>}

  {tab==='templates'&&<main className="grid2"><section className="panel"><h2>{templateForm.id?'Editar modelo':'Novo modelo'}</h2><label>Nome<input value={templateForm.name} onChange={e=>setTemplateForm({...templateForm,name:e.target.value})}/></label><div className="checks">{exercises.map(e=><label key={e.id}><input type="checkbox" checked={templateForm.exerciseIds.includes(e.id)} onChange={()=>setTemplateForm(f=>({...f,exerciseIds:f.exerciseIds.includes(e.id)?f.exerciseIds.filter(x=>x!==e.id):[...f.exerciseIds,e.id]}))}/>{e.name}</label>)}</div><button onClick={saveTemplate}><Save size={18}/> Salvar modelo</button></section><section><h2>Modelos</h2><div className="cards">{templates.map(t=><article className="mini" key={t.id}><span className="pill">{t.exerciseIds.length} exercícios</span><h3>{t.name}</h3><p>{t.exerciseIds.map(id=>exercises.find(e=>e.id===id)?.name).filter(Boolean).join(' · ')}</p><div className="row"><button onClick={()=>{setTemplateForm(t);scrollTo(0,0)}}>Editar</button><button className="danger" onClick={()=>confirm('Excluir modelo?')&&deleteDoc(doc(db,base,'templates',t.id))}>Excluir</button></div></article>)}</div></section></main>}

  {tab==='history'&&<main><section className="hero"><div><span className="kicker">EVOLUÇÃO</span><h2>Histórico</h2><p>Treinos concluídos e séries registradas.</p></div></section><div className="history">{!workouts.length?<div className="empty">Nenhum treino concluído.</div>:workouts.map(w=><article className="panel" key={w.id}><div className="panelHead"><div><h3>{w.templateName}</h3><span>{new Intl.DateTimeFormat('pt-BR',{dateStyle:'long'}).format(new Date(w.date+'T12:00:00'))}</span></div><button className="danger icon" onClick={()=>confirm('Excluir treino?')&&deleteDoc(doc(db,base,'workouts',w.id))}><Trash2 size={17}/></button></div>{w.items.map((it,i)=>{const ex=exercises.find(e=>e.id===it.exerciseId);return <div className="historyRow" key={i}><b>{ex?.name||'Exercício'}</b><span>{it.sets.filter(s=>s.weight||s.reps).map(s=>`${s.weight||0} kg × ${s.reps||0}`).join(' · ')}</span>{it.notes&&<small>{it.notes}</small>}</div>})}{w.notes&&<p>{w.notes}</p>}</article>)}</div></main>}
 </div>
}

function Login(){return <div className="login"><div className="loginCard"><div className="logo"><Dumbbell/></div><span className="kicker">MEUS.TREINOS</span><h1>Seu diário de treino</h1><p>Organize exercícios, modelos, séries e histórico em um só lugar.</p><button onClick={()=>signInWithPopup(auth,googleProvider)}><UserRound size={19}/> Entrar com Google</button></div></div>}
