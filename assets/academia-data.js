/* Academia Frío Austral · capa de datos (MODO DEMO).
   Toda la UI habla SOLO con window.AcademiaData. Cada método devuelve una Promise,
   así se puede reemplazar este archivo por una versión con Supabase (supabase-js:
   auth.signUp / signInWithPassword, tablas con RLS, Edge Function para URL firmada
   del video) sin tocar las páginas. Aquí los datos viven en localStorage de este
   navegador: NO es seguro para producción y no hay pagos reales. */
window.AcademiaData=(function(){
'use strict';
const K='fa_academia_v2',SK='fa_academia_session',SUBS='fa_demo_v1';
const now=()=>new Date().toISOString();
const uid=p=>p+'_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const ok=v=>Promise.resolve(v===undefined?v:JSON.parse(JSON.stringify(v)));
const fail=m=>Promise.reject(new Error(m));
const V='assets/video/';
const L=(id,t,src,poster,prev,pdfs)=>({id,title:t,description:'Clase en video del temario del curso. En esta demo el video y el PDF son de ejemplo.',video:(src.includes('/')?'':V)+src,poster:poster?(poster.includes('/')?'':V)+poster:'',duration:({'media/video/v2-curso-ac-720.mp4':21,'trailer-curso.mp4':18,'guillermo-hero-1080.mp4':10,'taller-guillermo.mp4':8})[src]||0,preview:!!prev,resources:(pdfs||[]).map(x=>({title:x+' (PDF)',url:'assets/academia/material-ejemplo.pdf'}))});
const seed=()=>({v:3,courses:[
 {id:'c1',slug:'aire-acondicionado-automotriz',title:'Formación en Aire Acondicionado Automotriz: Nivel Básico a Avanzado',
  short:'Desde los principios de refrigeración hasta técnicas avanzadas, con ejemplos del taller.',
  description:'Más de 6 horas de contenido grabado en 25 módulos, con material PDF descargable. Pago único: queda en tu cuenta para siempre.',
  cover:'media/img/i4-curso-sq-960.webp',trailer:'media/video/v2-curso-ac-720.mp4',trailerPoster:'media/img/v2-curso-poster-960.webp',
  price:60000,oldPrice:155000,status:'published',demo:true,
  modules:[
   {id:'m1',title:"Módulo 01 · Herramientas básicas",lessons:[L('l1-1',"Herramientas básicas.",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',true,["Herramientas para comenzar."])]},
   {id:'m2',title:"Módulo 02 · Herramientas avanzadas",lessons:[L('l2-1',"Herramientas avanzadas.",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,["Herramientas avanzadas en aire acondicionado."])]},
   {id:'m3',title:"Módulo 03 · Insumos básicos",lessons:[L('l3-1',"Insumos básicos para aire acondicionado",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Insumos básicos para aire acondicionado"])]},
   {id:'m4',title:"Módulo 04 · Función de las herramientas",lessons:[L('l4-1',"¿Cómo funcionan las herramientas?",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,["Función específica de las herramientas."])]},
   {id:'m5',title:"Módulo 05 · Conceptos de refrigeración",lessons:[L('l5-1',"Conceptos básicos de refrigeración.",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,["Teoría de los conceptos."])]},
   {id:'m6',title:"Módulo 06 · Circuito de aire acondicionado automotriz",lessons:[L('l6-1',"Circuito de refrigeración.",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[]),L('l6-2',"¿Por qué un sistema se obstruye?",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,["Circuito de refrigeración."])]},
   {id:'m7',title:"Módulo 07 · ¿Cómo identificar la conexión del manómetro?",lessons:[L('l7-1',"¿Cómo identificar las conexiones del manómetros?",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,["Pdf sobre las conexiones"])]},
   {id:'m8',title:"Módulo 08 · ¿Cómo cargar refrigerante a los sistemas?",lessons:[L('l8-1',"¿Cómo cargar con gas refrigerante un sistema de aire acondicionado?",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[])]},
   {id:'m9',title:"Módulo 09 · Funciones del multímetro",lessons:[L('l9-1',"¿Cómo utilizar el multímetro?",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[])]},
   {id:'m10',title:"Módulo 10 · Factores claves para una carga correcta",lessons:[L('l10-1',"Proceso para carga de gas",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,["Factores Clave para una Carga Correcta"])]},
   {id:'m11',title:"Módulo 11 · ¿Cómo funcionan los presostatos?",lessons:[L('l11-1',"Presostatos",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[]),L('l11-2',"Falla común de los sensores de 3 y 4 pines",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l11-3',"Caso práctico de presostatos de dos pines",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,["¿Cómo Funcionan los Presostatos?"])]},
   {id:'m12',title:"Módulo 12 · Componentes eléctricos y funciones",lessons:[L('l12-1',"Explicación del flujo de corriente en el sistema",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[]),L('l12-2',"¿Cómo interpretar caja de relay?",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l12-3',"¿Cómo encontrar fusible?",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l12-4',"¿Cómo diagnosticamos y hacemos cambio del fusible de compresor?",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[])]},
   {id:'m13',title:"Módulo 13 · Tipos de compresores",lessons:[L('l13-1',"Compresores",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l13-2',"Partes externas de compresor",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l13-3',"Desmontaje de válvula",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Tipos de Compresores"])]},
   {id:'m14',title:"Módulo 14 · Válvulas de expansión",lessons:[L('l14-1',"¿Cómo funciona la válvula de expansión?",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l14-2',"Válvula tipo block",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l14-3',"Cambio de válvula",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Válvulas de Expansión"])]},
   {id:'m15',title:"Módulo 15 · Tipos de sellos para el circuito",lessons:[L('l15-1',"Tipos de sellos",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,["Tipos de Sellos en el Sistema de Refrigeración Automotriz"])]},
   {id:'m16',title:"Módulo 16 · Aceite para sistemas de refrigeración",lessons:[L('l16-1',"Carga de aceite",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l16-2',"¿Cómo escoger el aceite?",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[]),L('l16-3',"¿Cómo se distribuye el aceite en el sistema?",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,["Tabla de aceites en pdf", "Carga de Aceite Correcta"])]},
   {id:'m17',title:"Módulo 17 · Soldadura de aluminio",lessons:[L('l17-1',"Soldadura de aluminio",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l17-2',"Reparación de cañería de aluminio",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Soldaduras de Aluminio"])]},
   {id:'m18',title:"Módulo 18 · Prensado de mangueras",lessons:[L('l18-1',"Prensado",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l18-2',"Fitting",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l18-3',"Reparación de cañerías y explicación",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Prensado de Mangueras"])]},
   {id:'m19',title:"Módulo 19 · ¿Cómo hacer el cambio de un compresor?",lessons:[L('l19-1',"Cambio de compresor",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l19-2',"Cambio de un compresor en Peugeot Rifter",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,["Cómo Cambiar un Compresor"])]},
   {id:'m20',title:"Módulo 20 · ¿Cómo cambiar bobinas de los compresores?",lessons:[L('l20-1',"¿Cómo cambiar bobina de compresor?",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["¿Cómo Cambiar las Bobinas del Compresor?"])]},
   {id:'m21',title:"Módulo 21 · ¿Cómo cambiar condensador?",lessons:[L('l21-1',"Cambio de condensador",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l21-2',"Variaciones en condensador",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l21-3',"¿Cómo desmontar parachoques para montar un condensador?",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Cómo Cambiar un Condensador"])]},
   {id:'m22',title:"Módulo 22 · ¿Cómo cambiar válvulas de servicio?",lessons:[L('l22-1',"Cambio de válvula de servicio",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,["¿Cómo Cambiar la Válvula de Servicio?"])]},
   {id:'m23',title:"Módulo 23 · ¿Cómo cambiar filtro polen?",lessons:[L('l23-1',"Cambio de filtro en Toyota",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l23-2',"Cambio de filtro polen Chevrolet",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Cambio del Filtro de Polen en Vehículos"])]},
   {id:'m24',title:"Módulo 24 · ¿Cómo hacer pruebas de fugas?",lessons:[L('l24-1',"Prueba de fugas",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,["Prueba de Nitrógeno"])]},
   {id:'m25',title:"Módulo 25 · Fallas comunes en los circuitos",lessons:[L('l25-1',"Falla Interna de compresor",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l25-2',"Falla en válvula de control",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,[]),L('l25-3',"Falla en relay Hunday H1",'media/video/v2-curso-ac-720.mp4','media/img/v2-curso-poster-960.webp',false,[]),L('l25-4',"Compresor sin desplazamiento",'guillermo-hero-1080.mp4','guillermo-hero-poster.jpg',false,[]),L('l25-5',"¿Cómo identificar ventilador en mal estado?",'taller-guillermo.mp4','taller-guillermo-poster.jpg',false,["Fallas Comunes"])]}
  ]},
 {id:'c2',slug:'diagnostico-electrico-tableros',title:'Parte #2: Diagnóstico eléctrico y cambio de tableros',
  short:'Continuación a nivel profesional: diagramas, escáner y cambio de tableros.',
  description:'Continuación del curso principal, a nivel profesional.',cover:'media/img/c3-parte2-960.webp',
  trailer:'',trailerPoster:'',price:null,status:'soon',demo:false,modules:[]}],
 users:[{id:'u_demo',email:'demo@frioaustral.cl',name:'Alumno Demo',salt:'s_demo2026',hash:'50ec8ff91345056451d570fb0e9b4856a91e88b960ad9f267e0552f4c3db6b19',created:'2026-10-21T00:00:00.000Z',role:'student',demo:true}],enrollments:[],progress:{},notes:[],certs:[],resets:[],last:{}});
function db(){try{const d=JSON.parse(localStorage.getItem(K));if(d&&d.v===3){const S=seed().courses;let ch=0;(d.courses||[]).forEach(c=>{const o=S.find(x=>x.id===c.id);if(o&&c.cover!==o.cover&&/^assets\/curso-/.test(c.cover||'')){c.cover=o.cover;ch=1}if(o&&/trailer-curso/.test((c.trailer||'')+(c.trailerPoster||''))){c.trailer=o.trailer;c.trailerPoster=o.trailerPoster;ch=1}});if(ch)localStorage.setItem(K,JSON.stringify(d));return d}}catch(e){}const s=seed();localStorage.setItem(K,JSON.stringify(s));return s}
const save=d=>localStorage.setItem(K,JSON.stringify(d));
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const normEmail=e=>String(e||'').trim().toLowerCase();
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const pub=u=>u&&({id:u.id,email:u.email,name:u.name,role:u.role||'student',created:u.created});
const lessonsOf=c=>c.modules.flatMap(m=>m.lessons.map(l=>({...l,moduleId:m.id})));
function sess(){try{const s=JSON.parse(localStorage.getItem(SK));if(s&&s.exp>Date.now())return s}catch(e){}return null}
function me(d){const s=sess();return s?d.users.find(u=>u.id===s.uid)||null:null}
const enrolled=(d,u,c)=>!!u&&d.enrollments.some(e=>e.userId===u.id&&e.courseId===c.id&&e.status==='active');
const findCourse=(d,slug)=>d.courses.find(c=>c.slug===slug||c.id===slug);
function courseProgress(d,u,c){const ls=lessonsOf(c);if(!u||!ls.length)return {done:0,total:ls.length,pct:0};
 const p=d.progress[u.id]||{};const done=ls.filter(l=>p[l.id]&&p[l.id].done).length;return {done,total:ls.length,pct:Math.round(done*100/ls.length)}}
/* Lo que el público puede ver: sin URL de video salvo vista previa (en Supabase: RLS + URL firmada) */
function publicCourse(c){return {...c,modules:c.modules.map(m=>({...m,lessons:m.lessons.map(l=>{const {video,resources,...r}=l;return {...r,resources:[],video:l.preview?video:null}})}))}}

const auth={
 async current(){return pub(me(db()))},
 async register({name,email,password}){email=normEmail(email);name=String(name||'').trim();
  if(!name)return fail('Escribe tu nombre.');if(!validEmail(email))return fail('Revisa tu email.');
  if(String(password||'').length<8)return fail('La contraseña debe tener al menos 8 caracteres.');
  const d=db();if(d.users.some(u=>u.email===email))return fail('Ya existe una cuenta con ese email. Ingresa o recupera tu contraseña.');
  const salt=uid('s'),u={id:uid('u'),email,name,salt,hash:await sha(salt+':'+password),created:now(),role:'student'};
  d.users.push(u);save(d);localStorage.setItem(SK,JSON.stringify({uid:u.id,exp:Date.now()+30*864e5}));return pub(u)},
 async login({email,password}){email=normEmail(email);const d=db(),u=d.users.find(x=>x.email===email);
  /* demo: limita intentos por email en esta sesión del navegador */
  const tk='fa_ac_try_'+email,t=JSON.parse(sessionStorage.getItem(tk)||'{"n":0,"at":0}');
  if(t.n>=5&&Date.now()-t.at<60000)return fail('Demasiados intentos. Espera un minuto e intenta de nuevo.');
  if(!u||await sha(u.salt+':'+password)!==u.hash){sessionStorage.setItem(tk,JSON.stringify({n:t.n+1,at:Date.now()}));return fail('Email o contraseña incorrectos.')}
  sessionStorage.removeItem(tk);localStorage.setItem(SK,JSON.stringify({uid:u.id,exp:Date.now()+30*864e5}));return pub(u)},
 async logout(){localStorage.removeItem(SK)},
 /* demo: en producción esto envía un email con link; aquí se devuelve el token para mostrar el link en pantalla */
 async requestReset(email){email=normEmail(email);const d=db(),u=d.users.find(x=>x.email===email);
  if(!u)return {sent:true,demoToken:null};const tok=uid('r');d.resets=d.resets.filter(r=>r.userId!==u.id);d.resets.push({tok,userId:u.id,exp:Date.now()+36e5});save(d);return {sent:true,demoToken:tok}},
 async resetPassword(tok,password){const d=db(),r=d.resets.find(x=>x.tok===tok&&x.exp>Date.now());if(!r)return fail('El link de recuperación venció o no es válido. Pide uno nuevo.');
  if(String(password||'').length<8)return fail('La contraseña debe tener al menos 8 caracteres.');
  const u=d.users.find(x=>x.id===r.userId);u.salt=uid('s');u.hash=await sha(u.salt+':'+password);d.resets=d.resets.filter(x=>x!==r);save(d);return true},
 async updateProfile({name}){const d=db(),u=me(d);if(!u)return fail('Ingresa primero.');name=String(name||'').trim();if(!name)return fail('Escribe tu nombre.');u.name=name;save(d);return pub(u)},
 async changePassword(oldP,newP){const d=db(),u=me(d);if(!u)return fail('Ingresa primero.');
  if(await sha(u.salt+':'+oldP)!==u.hash)return fail('La contraseña actual no es correcta.');
  if(String(newP||'').length<8)return fail('La nueva contraseña debe tener al menos 8 caracteres.');u.salt=uid('s');u.hash=await sha(u.salt+':'+newP);save(d);return true}
};
const catalog={
 async list(){const d=db();return ok(d.courses.filter(c=>c.status!=='draft').map(publicCourse))},
 async get(slug){const d=db(),c=findCourse(d,slug);if(!c||c.status==='draft')return null;const u=me(d);
  const full=enrolled(d,u,c);return ok({...(full?c:publicCourse(c)),enrolled:full,progress:courseProgress(d,u,c)})},
 /* equivalente a la Edge Function "firmar-video": solo entrega la lección si es vista previa o el alumno está inscrito */
 async lesson(slug,lessonId){const d=db(),c=findCourse(d,slug);if(!c||c.status!=='published')return {error:'notfound'};
  const ls=lessonsOf(c),i=ls.findIndex(l=>l.id===lessonId);if(i<0)return {error:'notfound'};const l=ls[i],u=me(d),full=enrolled(d,u,c);
  if(!full&&!l.preview)return {error:u?'nocompra':'nologin'};
  const p=(u&&d.progress[u.id]||{})[l.id]||null;
  return ok({lesson:l,index:i,total:ls.length,prev:ls[i-1]&&{id:ls[i-1].id,title:ls[i-1].title,locked:!full&&!ls[i-1].preview},next:ls[i+1]&&{id:ls[i+1].id,title:ls[i+1].title,locked:!full&&!ls[i+1].preview},
   course:full?c:publicCourse(c),enrolled:full,user:pub(u),progress:p,courseProgress:courseProgress(d,u,c),allProgress:u?d.progress[u.id]||{}:{}})}
};
const enrollments={
 async mine(){const d=db(),u=me(d);if(!u)return [];return ok(d.enrollments.filter(e=>e.userId===u.id&&e.status==='active').map(e=>{const c=d.courses.find(x=>x.id===e.courseId);if(!c)return null;
  const ls=lessonsOf(c),lastId=(d.last[u.id]||{})[c.id],last=ls.find(l=>l.id===lastId)||ls.find(l=>!((d.progress[u.id]||{})[l.id]||{}).done)||ls[0];
  return {course:{id:c.id,slug:c.slug,title:c.title,cover:c.cover},progress:courseProgress(d,u,c),continueLesson:last&&{id:last.id,title:last.title},started:!!lastId,cert:d.certs.find(x=>x.userId===u.id&&x.courseId===c.id)||null}}).filter(Boolean))},
 /* PAGO DE PRUEBA: no cobra nada. En producción lo reemplaza el webhook de la pasarela (Mercado Pago / Flow / Webpay) */
 async purchaseDemo(slug){const d=db(),u=me(d),c=findCourse(d,slug);if(!u)return fail('Ingresa para comprar.');if(!c||c.status!=='published')return fail('Este curso todavía no está a la venta.');
  if(enrolled(d,u,c))return {already:true};const e=d.enrollments.find(x=>x.userId===u.id&&x.courseId===c.id);
  if(e){e.status='active';e.revoked=null;e.source='demo'}else d.enrollments.push({id:uid('e'),userId:u.id,courseId:c.id,source:'demo',txn:uid('DEMO'),status:'active',created:now(),revoked:null});save(d);return {ok:true}}
};
const progress={
 async save(slug,lessonId,{pos,dur,done}){const d=db(),u=me(d),c=findCourse(d,slug);if(!u||!c||!enrolled(d,u,c))return null;
  const P=d.progress[u.id]=d.progress[u.id]||{},p=P[lessonId]=P[lessonId]||{pos:0,dur:0,done:false};
  if(pos!=null)p.pos=Math.max(0,+pos||0);if(dur)p.dur=+dur;if(done!=null)p.done=!!done;p.at=now();(d.last[u.id]=d.last[u.id]||{})[c.id]=lessonId;save(d);return ok({lesson:p,course:courseProgress(d,u,c)})}
};
const notes={
 async list(lessonId){const d=db(),u=me(d);if(!u)return [];return ok(d.notes.filter(n=>n.userId===u.id&&n.lessonId===lessonId).sort((a,b)=>a.t-b.t))},
 async add(lessonId,t,text){const d=db(),u=me(d);text=String(text||'').trim();if(!u)return fail('Ingresa primero.');if(!text)return fail('Escribe la nota.');if(text.length>1000)return fail('La nota es muy larga.');
  const n={id:uid('n'),userId:u.id,lessonId,t:Math.max(0,Math.floor(t||0)),text,created:now()};d.notes.push(n);save(d);return ok(n)},
 async remove(id){const d=db(),u=me(d);d.notes=d.notes.filter(n=>!(n.id===id&&u&&n.userId===u.id));save(d)}
};
const certificates={
 async issue(slug){const d=db(),u=me(d),c=findCourse(d,slug);if(!u||!c||!enrolled(d,u,c))return fail('No tienes este curso.');
  if(courseProgress(d,u,c).pct<100)return fail('Completa todas las lecciones para obtener el certificado.');
  let x=d.certs.find(k=>k.userId===u.id&&k.courseId===c.id);
  if(!x){const r=crypto.getRandomValues(new Uint8Array(6)),A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code='FA-'+[...r].map(b=>A[b%A.length]).join('').replace(/(.{3})/,'$1-');
   x={code,userId:u.id,courseId:c.id,name:u.name,course:c.title,issued:now()};d.certs.push(x);save(d)}return ok(x)},
 async verify(code){const d=db(),x=d.certs.find(k=>k.code===String(code||'').trim().toUpperCase());return x?ok({code:x.code,name:x.name,course:x.course,issued:x.issued}):null}
};
/* Suscripción de consultas (maqueta existente fa_demo_v1): solo para saber si mostrar "Preguntas" */
const subscription={async forMe(){const u=me(db());if(!u)return null;try{const s=(JSON.parse(localStorage.getItem(SUBS))||{subs:[]}).subs.find(x=>String(x.email).toLowerCase()===u.email);return s?{plan:s.plan,active:s.estado==='activa'}:null}catch(e){return null}}};
/* Admin (en producción: rol admin + políticas RLS de escritura) */
const admin={
 async courses(){return ok(db().courses)},
 async saveCourse(c){const d=db();const slug=String(c.slug||c.title||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if(!String(c.title||'').trim())return fail('Escribe el nombre del curso.');if(!slug)return fail('Revisa el nombre corto (slug).');
  if(d.courses.some(x=>x.slug===slug&&x.id!==c.id))return fail('Ya hay otro curso con ese nombre corto.');
  const i=d.courses.findIndex(x=>x.id===c.id),n={modules:[],status:'draft',demo:false,price:null,cover:'',trailer:'',trailerPoster:'',short:'',description:'',...(i>=0?d.courses[i]:{}),...c,slug,id:c.id||uid('c')};
  i>=0?d.courses[i]=n:d.courses.push(n);save(d);return ok(n)},
 async deleteCourse(id){const d=db();d.courses=d.courses.filter(c=>c.id!==id);save(d)},
 async restoreCourses(list){const d=db();d.courses=list;save(d)},
 newId:p=>uid(p),
 async students(){const d=db();return ok(d.users.map(u=>({...pub(u),courses:d.courses.filter(c=>c.status!=='draft').map(c=>{const e=d.enrollments.find(x=>x.userId===u.id&&x.courseId===c.id);return {id:c.id,title:c.title,status:e?e.status:'none',source:e&&e.source,progress:courseProgress(d,u,c)}})})))},
 async setAccess(userId,courseId,on){const d=db();let e=d.enrollments.find(x=>x.userId===userId&&x.courseId===courseId);
  if(on){if(e){e.status='active';e.revoked=null;e.source=e.source||'manual'}else d.enrollments.push({id:uid('e'),userId,courseId,source:'manual',txn:null,status:'active',created:now(),revoked:null})}
  else if(e){e.status='revoked';e.revoked=now()}save(d);return true},
 async resetDemo(){localStorage.removeItem(K);db()}
};
return {mode:'demo',auth,catalog,enrollments,progress,notes,certificates,subscription,admin};
})();
