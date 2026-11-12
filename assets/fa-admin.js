/* Panel admin Frío Austral (maqueta). Datos en este navegador: localStorage + IndexedDB vía fa-store.js */
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clp=n=>'$'+Math.round(Number(n)||0).toLocaleString('es-CL');
const now=()=>new Date().toISOString();
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ---------- íconos (trazos estilo Lucide) ---------- */
const P={home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
msg:'<path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L3 21l1.5-5.4A8.5 8.5 0 1 1 21 12z"/>',
users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.7 2.5 3 5.2"/>',
shop:'<path d="M4 7h16l-1.5 12.5a1.5 1.5 0 0 1-1.5 1.3H7a1.5 1.5 0 0 1-1.5-1.3zM9 7a3 3 0 0 1 6 0"/>',
video:'<rect x="2.5" y="5" width="14" height="14" rx="2"/><path d="m16.5 10 5-3v10l-5-3"/>',
link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
help:'<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4M12 17.5h.01"/>',
out:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
back:'<path d="m15 18-6-6 6-6"/>',send:'<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
clip:'<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
cam:'<path d="M14.5 4h-5L7.5 6.5H4a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3.5z"/><circle cx="12" cy="13" r="3.5"/>',
plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
eyeoff:'<path d="M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a10 10 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
ext:'<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',alert:'<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
pause:'<circle cx="12" cy="12" r="9.5"/><path d="M10 9v6M14 9v6"/>',play:'<circle cx="12" cy="12" r="9.5"/><path d="m10 8.5 5 3.5-5 3.5z"/>',
money:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
cap:'<path d="M2 9.5 12 5l10 4.5-10 4.5z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9.5V15"/>',upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'};
const I=(k,l)=>`<svg class="i" viewBox="0 0 24 24" ${l?`role="img" aria-label="${esc(l)}"`:'aria-hidden="true"'}>${P[k]}</svg>`;
/* ---------- datos ---------- */
const K='fa_demo_v1',SK='fa_admin_session';
const seed=()=>({subs:[
 {id:'s1',nombre:'Pedro Soto',email:'pedro@ejemplo.cl',plan:'basico',estado:'activa',usadas:2,msgs:[{de:'u',t:'¿Qué aceite lleva un compresor Denso 10S17?',f:now()},{de:'a',t:'PAG 46, revisa la etiqueta del compresor.',f:now()},{de:'u',t:'¿Cuánto gas lleva una Hilux 2018?',f:now()}]},
 {id:'s2',nombre:'Taller Los Lagos',email:'contacto@ejemplo.cl',plan:'premium',estado:'activa',usadas:7,msgs:[{de:'u',t:'¿Cómo detecto una fuga con nitrógeno?',f:now()},{de:'a',t:'Presuriza a 150 psi y deja 30 min, revisa con espuma.',f:now()}]},
 {id:'s3',nombre:'Camila Ruiz',email:'camila@ejemplo.cl',plan:'basico',estado:'vencida',usadas:3,msgs:[{de:'u',t:'¿Sirve el R134a en un auto con R1234yf?',f:now()},{de:'a',t:'No, no se deben mezclar ni reemplazar.',f:now()}]}],me:null});
const db=()=>{try{return JSON.parse(localStorage.getItem(K))||seed()}catch(e){return seed()}};
const save=d=>localStorage.setItem(K,JSON.stringify(d));
const PL={basico:{n:'Consulta',p:5000,lim:3},pro:{n:'Ilimitado',p:10000,lim:Infinity},premium:{n:'Taller Pro',p:20000,lim:Infinity}};
const planChip=p=>`<span class="chip p-${esc(p)}">${esc((PL[p]||{n:p}).n)} · ${clp((PL[p]||{}).p)}</span>`;
const estChip=e=>e==='activa'?`<span class="chip e-ok">${I('check')}Al día</span>`:`<span class="chip e-bad">${I('pause')}Vencida</span>`;
const pending=s=>s.msgs.length&&s.msgs[s.msgs.length-1].de==='u';
const unread=s=>pending(s)&&s.estado==='activa';
const ini=n=>String(n).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const first=n=>String(n).split(/\s+/)[0];
const hm=f=>{const d=new Date(f),t=new Date();return d.toDateString()===t.toDateString()?d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('es-CL',{day:'numeric',month:'short'})};
const prog=s=>{const L=PL[s.plan];if(!L||L.lim===Infinity)return `<span class="prog">${esc(s.usadas)} preguntas · sin límite</span>`;const u=Math.min(L.lim,s.usadas);return `<span class="prog ${u>=L.lim?'full':''}" aria-label="${u} de ${L.lim} preguntas usadas este mes"><i style="--w:${u/L.lim*100}%"></i>${u}/${L.lim}</span>`};
/* ---------- toasts, confirmación, hojas ---------- */
function toast(m,o={}){const t=document.createElement('div');t.className='tst'+(o.err?' err':'');t.innerHTML=`<p>${esc(m)}</p>`;
 if(o.undo){const b=document.createElement('button');b.className='b b-gh';b.textContent='Deshacer';b.onclick=()=>{o.undo();t.remove();toast('Listo, se deshizo')};t.append(b)}
 $('#toasts').append(t);setTimeout(()=>t.remove(),o.undo?5000:3200)}
let lastFocus=null;
function sheet(html,{label='Ventana',onClose}={}){closeSheet();lastFocus=document.activeElement;const bg=document.createElement('div');bg.className='sheet-bg';bg.id='sheet';
 bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;document.body.append(bg);
 bg.addEventListener('click',e=>{if(e.target===bg){closeSheet();onClose&&onClose()}});
 bg._close=onClose;const f=$('input,textarea,button,select,[tabindex]',bg);f&&f.focus();return $('.sheet',bg)}
function closeSheet(){const s=$('#sheet');if(s){s.remove();lastFocus&&lastFocus.focus&&lastFocus.focus()}}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#sheet')){const c=$('#sheet')._close;closeSheet();c&&c()}closeMenus()}
 if(e.key==='Tab'&&$('#sheet')){const f=$$('#sheet button,#sheet input,#sheet textarea,#sheet select,#sheet a').filter(x=>!x.disabled&&x.offsetParent);if(!f.length)return;const a=f[0],z=f[f.length-1];
  if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}});
function ask(title,text,okTxt,danger){return new Promise(res=>{const s=sheet(`<h2>${esc(title)}</h2><p style="color:var(--mut)">${esc(text)}</p><div class="acts"><button class="b b-sec" data-r="0">Cancelar</button><button class="b ${danger?'b-pri':'b-pri'}" data-r="1">${esc(okTxt)}</button></div>`,{label:title,onClose:()=>res(false)});
 $$('[data-r]',s).forEach(b=>b.onclick=()=>{closeSheet();res(b.dataset.r==='1')});$('[data-r="1"]',s).focus()})}
/* ---------- login (credenciales de la maqueta solo como hash) ---------- */
const AUTH='b15ac7ff802ffcb0a86c543fba503414df523790ff27be11b15e7539a79e653a';
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const logged=()=>sessionStorage.getItem(SK)==='1';
function loginView(){document.title='Ingresar · Panel Frío Austral';
 $('#app').innerHTML=`<main class="login"><form class="login-c" id="lf" novalidate><img src="assets/logo-frio-austral.png" alt="Frío Austral" width="64" height="64"><h1>Panel Frío Austral</h1><p>Entra para responder preguntas y administrar el sitio.</p>
 <label class="f"><span>Usuario</span><input class="in" name="u" autocomplete="username" required></label>
 <label class="f"><span>Contraseña</span><input class="in" name="p" type="password" autocomplete="current-password" required></label>
 <p class="ferr" id="le" role="alert" hidden></p><button class="b b-pri b-big">Entrar</button>
 <details class="demo-n"><summary>¿Es la maqueta? Ver acceso de prueba</summary><p>Pide el acceso de prueba a Mathias. En el sitio real se entra con la cuenta de cada persona.</p></details></form></main>`;
 $('#lf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),u=String(f.get('u')).trim(),p=String(f.get('p'));
  if(!u||!p){$('#le').textContent='Escribe tu usuario y tu contraseña.';$('#le').hidden=false;return}
  let ok=false;try{ok=await sha(u+':'+p)===AUTH}catch(err){ok=false}
  if(!ok){$('#le').textContent='Usuario o contraseña incorrectos. Revisa e intenta de nuevo.';$('#le').hidden=false;$('[name=p]').value='';$('[name=p]').focus();return}
  sessionStorage.setItem(SK,'1');if(!location.hash)location.hash='#/inicio';boot();toast('Hola '+NAME+', bienvenido')};
 $('[name=u]').focus()}
/* ---------- shell ---------- */
const NAME='Guillermo';
const NAV=[['inicio','Inicio','home'],['mensajes','Mensajes','msg'],['suscriptores','Suscriptores','users'],['academia','Academia','cap'],['tienda','Tienda','shop'],['video','Video portada','video'],['links','Links de venta','link'],['ajustes','Ajustes','gear']];
const MOB=[['inicio','Inicio','home'],['mensajes','Mensajes','msg'],['suscriptores','Clientes','users'],['tienda','Tienda','shop']];
function shell(){$('#app').innerHTML=`<div class="shell">
 <aside class="side" aria-label="Menú del panel"><a class="brand" href="#/inicio"><img src="assets/logo-frio-austral.png" alt="" width="40" height="40"><span><b>Frío Austral</b><small>Panel de ${NAME}</small></span></a>
  <nav aria-label="Secciones">${NAV.map(([k,l,i])=>`<a class="nv" data-nv="${k}" href="#/${k}">${I(i)}<span>${l}</span>${k==='mensajes'?'<span class="cnt" data-cnt hidden></span>':''}</a>`).join('')}</nav>
  <div class="sp"></div><button class="nv" data-act="help">${I('help')}<span>Ayuda</span></button></aside>
 <div class="main">
  <header class="top"><a class="brand" href="#/inicio" aria-label="Frío Austral, ir a inicio"><img src="assets/logo-frio-austral.png" alt="" width="36" height="36"><b>Frío Austral</b></a><span class="sp"></span>
   <div class="gs" id="gs" role="search"><label class="sr" for="gq">Buscar</label>${I('search')}<input class="in" id="gq" type="search" role="combobox" aria-autocomplete="list" placeholder="Buscar cliente, correo o producto" autocomplete="off" aria-controls="gsr" aria-expanded="false"><div class="gsr" id="gsr" role="listbox" aria-label="Resultados" hidden></div></div>
   <button class="b b-gh b-ic" data-act="msearch" aria-label="Buscar" id="msb">${I('search')}</button>
   <button class="b b-gh b-ic" data-act="help" aria-label="Ayuda">${I('help')}</button>
   <button class="av" data-act="avatar" aria-haspopup="menu" aria-expanded="false" aria-label="G, menú de cuenta de ${NAME}">G</button>
   <div class="menu" id="am" role="menu" hidden><button role="menuitem" data-go="ajustes">${I('gear')}Ajustes</button><button role="menuitem" data-act="theme">${I('sun')}Cambiar modo claro/oscuro</button><button role="menuitem" data-act="help">${I('help')}Ayuda</button><button role="menuitem" data-act="logout">${I('out')}Cerrar sesión</button></div></header>
  <main class="view" id="view" tabindex="-1"></main></div>
 <nav class="bot" aria-label="Secciones">${MOB.map(([k,l,i])=>`<a data-nv="${k}" href="#/${k}">${I(i)}<span>${l}</span>${k==='mensajes'?'<span class="cnt" data-cnt hidden></span>':''}</a>`).join('')}<button data-act="more" data-nv="mas" aria-haspopup="dialog">${I('more')}<span>Más</span></button></nav></div>`;
 bindShell()}
function closeMenus(){const m=$('#am');if(m&&!m.hidden){m.hidden=true;$('[data-act=avatar]').setAttribute('aria-expanded','false')}$$('.dmenu').forEach(x=>x.remove());const r=$('#gsr');if(r)r.hidden=true;const g=$('#gs');if(g)g.classList.remove('open')}
function bindShell(){
 document.onclick=e=>{const a=e.target.closest('[data-act]'),g=e.target.closest('[data-go]');
  if(!e.target.closest('#am,[data-act=avatar],.dmenu,[data-dots],#gs,#msb'))closeMenus();
  if(g){e.preventDefault();closeMenus();closeSheet();location.hash='#/'+g.dataset.go;return}
  if(!a)return;const k=a.dataset.act;
  if(k==='avatar'){const m=$('#am');m.hidden=!m.hidden;a.setAttribute('aria-expanded',String(!m.hidden));if(!m.hidden)$('button',m).focus()}
  if(k==='logout'){sessionStorage.removeItem(SK);closeMenus();location.hash='';loginView();toast('Cerraste sesión')}
  if(k==='theme'){const l=document.documentElement.dataset.theme==='light';setTheme(l?'dark':'light');closeMenus()}
  if(k==='help'){closeMenus();help()}
  if(k==='more')more();
  if(k==='msearch'){$('#gs').classList.add('open');$('#gq').focus()}};
 const q=$('#gq'),r=$('#gsr');
 q.oninput=()=>{const v=q.value.trim().toLowerCase();if(!v){r.hidden=true;q.setAttribute('aria-expanded','false');return}
  const S=db().subs.filter(s=>(s.nombre+' '+s.email).toLowerCase().includes(v)),C=FA.getCat().filter(p=>p.nombre.toLowerCase().includes(v));
  r.innerHTML=(S.map(s=>`<button data-go="mensajes/${esc(s.id)}">${I('users')}<span>${esc(s.nombre)} <small style="color:var(--mut)">· ${esc(s.email)}</small></span></button>`).join('')+C.map(p=>`<button data-go="tienda/${esc(p.id)}">${I('shop')}<span>${esc(p.nombre)}</span></button>`).join(''))||'<p>No encontramos nada con esa palabra.</p>';
  r.hidden=false;q.setAttribute('aria-expanded','true')};
 q.onkeydown=e=>{if(e.key==='Enter'){const b=$('button',r);b&&b.click()}if(e.key==='ArrowDown'){const b=$('button',r);b&&(e.preventDefault(),b.focus())}};
 q.onblur=()=>setTimeout(()=>{if(!$('#gs').contains(document.activeElement)){r.hidden=true;$('#gs').classList.remove('open')}},150)}
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('fa_admin_theme',t);toast(t==='light'?'Modo claro activado':'Modo oscuro activado')}
function more(){sheet(`<h2>Más opciones</h2><div style="display:grid;gap:4px">${[['academia','Academia','cap'],['video','Video portada','video'],['links','Links de venta','link'],['ajustes','Ajustes','gear']].map(([k,l,i])=>`<button class="nv" data-go="${k}">${I(i)}<span>${l}</span></button>`).join('')}<button class="nv" data-act="help">${I('help')}<span>Ayuda</span></button><button class="nv" data-act="logout">${I('out')}<span>Cerrar sesión</span></button></div>`,{label:'Más opciones'})}
function help(){sheet(`<h2>¿Cómo se usa?</h2><ul class="hlp"><li><b>Responder preguntas:</b> toca <b>Mensajes</b>, elige a la persona, escribe y toca enviar.</li><li><b>Suspender o activar un plan:</b> en <b>Clientes</b>, toca los tres puntos (⋯) de la persona.</li><li><b>Agregar un producto:</b> en <b>Tienda</b>, toca <b>Agregar producto</b>.</li><li><b>Cambiar el video de inicio:</b> en <b>Video portada</b>.</li><li>Si te equivocas, toca <b>Deshacer</b> en el aviso de abajo.</li></ul><div class="acts"><button class="b b-sec" data-act="tour">Ver el recorrido</button><button class="b b-pri" data-close>Entendido</button></div>`,{label:'Ayuda'});
 $('[data-close]').onclick=closeSheet;$('#sheet [data-act=tour]').onclick=()=>{closeSheet();tour(0)}}
const TOUR=[['Responde desde Mensajes','Las preguntas nuevas salen primero, con un punto rojo. Toca una para contestar.'],['Revisa a tus clientes','En Clientes ves el plan y si están al día. Con los tres puntos (⋯) puedes suspender o activar.'],['Si te equivocas, Deshacer','Cada vez que cambies algo te aparece un aviso abajo con el botón Deshacer.']];
function tour(i){const end=()=>{localStorage.setItem('fa_admin_tour','1');$('#tour')&&$('#tour').remove()};
 $('#tour')&&$('#tour').remove();if(i>=TOUR.length)return end();const d=document.createElement('div');d.className='tour';d.id='tour';
 d.innerHTML=`<div class="card" role="dialog" aria-modal="true" aria-labelledby="tt"><div class="dt" aria-label="Paso ${i+1} de 3">${TOUR.map((_,j)=>`<i class="${j===i?'on':''}"></i>`).join('')}</div><h2 id="tt">${TOUR[i][0]}</h2><p style="color:var(--mut)">${TOUR[i][1]}</p><div class="acts"><button class="b b-gh" id="tsk">Saltar</button><button class="b b-pri" id="tnx">${i<2?'Siguiente':'Empezar'}</button></div></div>`;
 document.body.append(d);$('#tsk').onclick=end;$('#tnx').onclick=()=>tour(i+1);$('#tnx').focus()}
/* ---------- router ---------- */
function route(){if(!logged())return loginView();if(!$('.shell'))shell();
 const [v='inicio',id]=location.hash.replace(/^#\/?/,'').split('/');const cur=(NAV.find(n=>n[0]===v)||NAV[0])[0];
 $$('[data-nv]').forEach(a=>{const on=a.dataset.nv===cur||(a.dataset.nv==='mas'&&['academia','video','links','ajustes'].includes(cur));on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
 closeMenus();const V={inicio,mensajes,suscriptores,academia,tienda,video,links,ajustes};
 document.title=(NAV.find(n=>n[0]===cur)[1])+' · Panel Frío Austral';V[cur](id);counts()}
function counts(){const n=db().subs.filter(unread).length;$$('[data-cnt]').forEach(c=>{c.innerHTML=n+'<span class="sr"> sin responder</span>';c.hidden=!n})}
const view=h=>{$('#view').innerHTML=h};
/* ---------- Inicio ---------- */
function inicio(){view(`<div class="kp">${'<div class="sk"></div>'.repeat(4)}</div>`);
 requestAnimationFrame(()=>{const L=db().subs,act=L.filter(s=>s.estado==='activa'),venc=L.length-act.length,pn=L.filter(unread),ing=act.reduce((a,s)=>a+(PL[s.plan]||{p:0}).p,0);
  const pc=p=>act.filter(s=>s.plan===p).length;const h=new Date().getHours(),sal=h<12?'Buenos días':h<20?'Buenas tardes':'Buenas noches';
  view(`<div class="ph"><div><p style="color:var(--mut)">${sal}</p><h1 class="hello">Hola ${NAME}</h1><p>${pn.length?`Tienes ${pn.length} ${pn.length===1?'pregunta':'preguntas'} esperando respuesta.`:'Estás al día con las preguntas.'}</p></div></div>
  <div class="kp">
   <a class="kpi ${pn.length?'hot':''}" href="#/mensajes${pn[0]?'/'+esc(pn[0].id):''}"><span>${I('msg')}Sin responder</span><b>${pn.length}</b><small>${pn.length?'Toca para contestar':'Nada pendiente'}</small></a>
   <a class="kpi" href="#/suscriptores/activa"><span>${I('check')}Clientes al día</span><b>${act.length}</b><small>de ${L.length} en total</small></a>
   <a class="kpi" href="#/suscriptores/vencida"><span>${I('pause')}Vencidos</span><b>${venc}</b><small>${venc?'No pueden preguntar':'Ninguno'}</small></a>
   <a class="kpi" href="#/suscriptores"><span>${I('money')}Ingresos del mes</span><b style="font-size:34px">${clp(ing)}</b><small>Estimado con los planes al día</small></a></div>
  <h2 class="sec-t">Clientes por plan</h2>
  <div class="kp">${['basico','pro','premium'].map(p=>`<a class="kpi" href="#/suscriptores/${p}"><span>${planChip(p)}</span><b>${pc(p)}</b><small>${PL[p].lim===Infinity?'Preguntas sin límite':'3 preguntas al mes'}${p==='premium'?' + llamadas':''}</small></a>`).join('')}
   <a class="kpi" href="#/tienda"><span>${I('shop')}Tienda</span><b>${FA.getCat().filter(x=>x.visible).length}</b><small>productos visibles</small></a></div>`)});
 if(!localStorage.getItem('fa_admin_tour'))setTimeout(()=>tour(0),300)}
/* ---------- Mensajes ---------- */
const QR=['¡Hola! Gracias por tu pregunta.','Revisa la etiqueta del compresor y me cuentas.','Mándame una foto para verlo mejor.','Te recomiendo traerlo al taller.'];
const draftK=id=>'fa_admin_draft_'+id;
function mensajes(id){const L=db().subs.slice().sort((a,b)=>unread(b)-unread(a)||new Date(b.msgs.at(-1)?.f||0)-new Date(a.msgs.at(-1)?.f||0));const s=L.find(x=>x.id===id);
 const list=L.length?L.map(x=>{const m=x.msgs.at(-1);return `<a class="mi ${unread(x)?'un':''}" href="#/mensajes/${esc(x.id)}" ${x.id===id?'aria-current="true"':''}><span class="pic" aria-hidden="true">${esc(ini(x.nombre))}</span><span class="tx"><span class="r1"><b>${esc(x.nombre)}</b><time>${m?hm(m.f):''}</time></span><span class="r2"><span class="ex">${m?(m.de==='a'?'Tú: ':'')+esc(m.t||'📷 Foto'):'Sin mensajes'}</span>${unread(x)?'<span class="cnt">1<span class="sr"> sin responder</span></span>':''}</span><span class="r2">${planChip(x.plan)}${x.estado!=='activa'?'<span class="chip e-bad">Vencida</span>':''}</span></span></a>`}).join(''):`<div class="empty">${I('msg')}<b>Todavía no hay mensajes</b><span>Cuando un cliente pregunte, aparecerá aquí.</span></div>`;
 view(`<div class="ph"><div><h1>Mensajes</h1><p>Las preguntas sin responder salen primero.</p></div></div><div class="msg ${s?'has':''}"><nav class="ml" aria-label="Conversaciones">${list}</nav><section class="cv" aria-label="Conversación">${s?chat(s):`<div class="empty">${I('msg')}<b>Elige una conversación</b><span>Toca un nombre de la lista para leer y responder.</span></div>`}</section></div>`);
 if(s)bindChat(s)}
function chat(s){const act=s.estado==='activa',L=PL[s.plan],lleno=L&&L.lim!==Infinity&&s.usadas>=L.lim;let day='';
 const b=s.msgs.map(m=>{const d=new Date(m.f).toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'});const sep=d!==day?`<span class="day">${esc(d)}</span>`:'';day=d;
  return sep+`<div class="bb ${m.de==='a'?'me':''}">${m.img?`<img src="${esc(m.img)}" alt="Foto enviada">`:''}${m.t?esc(m.t):''}<time>${m.de==='a'?'Tú · ':''}${new Date(m.f).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})}</time></div>`}).join('')||`<div class="empty"><b>Sin mensajes</b><span>Puedes escribirle primero.</span></div>`;
 return `<header class="ch"><a class="b b-gh b-ic bk" href="#/mensajes" aria-label="Volver a la lista">${I('back')}</a><span class="pic" aria-hidden="true" style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--s3);color:var(--ice);font-weight:800">${esc(ini(s.nombre))}</span><div class="who"><b>${esc(s.nombre)}</b><span class="meta">${planChip(s.plan)}${estChip(s.estado)}${prog(s)}</span></div></header>
 ${!act?`<p class="note">${I('alert')}<span>El plan de ${esc(first(s.nombre))} no está al día, así que no puede hacer preguntas nuevas. Igual puedes responderle.</span></p>`:lleno?`<p class="note">${I('alert')}<span>${esc(first(s.nombre))} ya usó sus 3 preguntas del mes. Puedes recomendarle el plan Ilimitado.</span></p>`:''}
 <div class="cb" id="cb" aria-live="polite">${b}</div>
 <div class="qr" aria-label="Respuestas rápidas">${QR.map(q=>`<button type="button" data-qr="${esc(q)}">${esc(q)}</button>`).join('')}</div>
 <div class="cmp-prev" id="cpv" hidden style="padding:8px 12px 0;display:flex;gap:8px;align-items:center"></div>
 <form class="cmp" id="cf"><input type="file" id="cfile" accept="image/*" hidden><button type="button" class="b b-gh b-ic" id="catt" aria-label="Adjuntar foto">${I('clip')}</button><label class="sr" for="cm">Escribe tu respuesta</label><textarea class="in" id="cm" rows="1" placeholder="Escribe tu respuesta…"></textarea><button class="b b-pri" aria-label="Enviar respuesta">${I('send')}</button></form>`}
function shrink(file,max=1000){return new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.82))};im.onerror=ko;im.src=r.result};r.onerror=ko;r.readAsDataURL(file)})}
function bindChat(s){const cb=$('#cb'),cm=$('#cm');cb.scrollTop=cb.scrollHeight;let img='';
 cm.value=localStorage.getItem(draftK(s.id))||'';
 const fit=()=>{cm.style.height='auto';cm.style.height=Math.min(140,cm.scrollHeight)+'px'};fit();
 cm.oninput=()=>{fit();localStorage.setItem(draftK(s.id),cm.value)};
 cm.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&matchMedia('(min-width:1024px)').matches){e.preventDefault();$('#cf').requestSubmit()}};
 $$('[data-qr]').forEach(b=>b.onclick=()=>{cm.value=(cm.value?cm.value.trim()+' ':'')+b.dataset.qr;cm.oninput();cm.focus()});
 $('#catt').onclick=()=>$('#cfile').click();
 $('#cfile').onchange=async()=>{const f=$('#cfile').files[0];if(!f)return;if(!/^image\//.test(f.type))return toast('Ese archivo no es una foto.',{err:1});
  try{img=await shrink(f,900);const p=$('#cpv');p.hidden=false;p.innerHTML=`<img src="${img}" alt="Foto lista para enviar" style="width:64px;height:64px;object-fit:cover;border-radius:10px"><button type="button" class="b b-gh" id="crm">Quitar foto</button>`;$('#crm').onclick=()=>{img='';p.hidden=true;p.innerHTML=''}}catch(e){toast('No pudimos leer esa foto.',{err:1})}};
 $('#cf').onsubmit=e=>{e.preventDefault();const t=cm.value.trim();if(!t&&!img){cm.focus();return toast('Escribe algo o adjunta una foto.',{err:1})}
  const d=db(),x=d.subs.find(y=>y.id===s.id);const m={de:'a',t,f:now()};if(img)m.img=img;x.msgs.push(m);
  try{save(d)}catch(err){x.msgs.pop();return toast('No hay espacio para esa foto. Prueba con una más liviana.',{err:1})}
  localStorage.removeItem(draftK(s.id));route();toast('Respuesta enviada a '+first(s.nombre));setTimeout(()=>{const c=$('#cm');c&&c.focus()},0)}}
/* ---------- Suscriptores ---------- */
let SF='todos',SQ='';
const FIL=[['todos','Todos'],['activa','Al día'],['vencida','Vencidos'],['basico','Consulta $5.000'],['pro','Ilimitado $10.000'],['premium','Taller Pro $20.000']];
function suscriptores(f){if(f&&FIL.some(x=>x[0]===f))SF=f;
 view(`<div class="ph"><div><h1>Clientes</h1><p>Personas suscritas a los planes de preguntas.</p></div></div>
 <div class="srch">${I('search')}<label class="sr" for="sq">Buscar cliente</label><input class="in" id="sq" type="search" placeholder="Buscar por nombre o correo" value="${esc(SQ)}"></div>
 <div class="flt" role="group" aria-label="Filtrar clientes">${FIL.map(([k,l])=>`<button type="button" data-f="${k}" aria-pressed="${SF===k}">${l}</button>`).join('')}</div>
 <div class="card" style="padding:0" id="sl"></div>`);
 const draw=()=>{const L=db().subs.filter(s=>(SF==='todos'||s.estado===SF||s.plan===SF)&&(!SQ||(s.nombre+' '+s.email).toLowerCase().includes(SQ.toLowerCase())));
  $('#sl').innerHTML=L.length?`<table class="tbl"><thead><tr><th>Cliente</th><th>Plan</th><th>Estado</th><th>Preguntas del mes</th><th><span class="sr">Acciones</span></th></tr></thead><tbody>${L.map(s=>`<tr><td class="nm"><b>${esc(s.nombre)}</b><small>${esc(s.email)}</small></td><td class="pl">${planChip(s.plan)}${unread(s)?'<span class="chip p-premium">Por responder</span>':''}</td><td class="es">${estChip(s.estado)}</td><td class="us">${prog(s)}</td><td class="ac"><div class="dots"><button class="b b-gh b-ic" data-dots="${esc(s.id)}" aria-haspopup="menu" aria-expanded="false" aria-label="Acciones para ${esc(s.nombre)}">${I('more')}</button></div></td></tr>`).join('')}</tbody></table>`
   :`<div class="empty">${I('users')}<b>${db().subs.length?'No hay clientes con ese filtro':'Todavía no hay clientes'}</b><span>${db().subs.length?'Prueba con otro nombre o toca "Todos".':'Cuando alguien contrate un plan aparecerá aquí.'}</span>${db().subs.length?'<button class="b b-sec" data-f="todos">Ver todos</button>':''}</div>`;
  $$('[data-dots]').forEach(b=>b.onclick=e=>{e.stopPropagation();const open=$('.dmenu',b.parentNode);closeMenus();if(open)return;const s=db().subs.find(x=>x.id===b.dataset.dots);
   const m=document.createElement('div');m.className='dmenu';m.setAttribute('role','menu');m.innerHTML=`<button role="menuitem" data-go="mensajes/${esc(s.id)}">${I('msg')}Ver chat</button>${s.estado==='activa'?`<button role="menuitem" data-tg>${I('pause')}Suspender plan</button>`:`<button role="menuitem" data-tg>${I('play')}Activar plan</button>`}`;
   b.parentNode.append(m);b.setAttribute('aria-expanded','true');$('button',m).focus();$('[data-tg]',m).onclick=()=>toggle(s.id,draw)});
  $$('#sl [data-f]').forEach(b=>b.onclick=()=>{SF='todos';SQ='';suscriptores()})};
 draw();$('#sq').oninput=e=>{SQ=e.target.value;draw()};
 $$('.flt [data-f]').forEach(b=>b.onclick=()=>{SF=b.dataset.f;$$('.flt [data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()})}
async function toggle(id,after){closeMenus();const d=db(),s=d.subs.find(x=>x.id===id),n=first(s.nombre),susp=s.estado==='activa';
 if(susp&&!await ask('¿Suspender el plan de '+n+'?',n+' no podrá hacer preguntas hasta que lo reactives.','Sí, suspender',true))return;
 const prev=s.estado;s.estado=susp?'vencida':'activa';save(d);after&&after();counts();
 toast(susp?'Plan de '+n+' suspendido':'Plan de '+n+' activado',{undo:()=>{const d2=db(),x=d2.subs.find(y=>y.id===id);x.estado=prev;save(d2);route()}})}
/* ---------- Tienda ---------- */
const PDK='fa_admin_pdraft';
function tienda(id){const C=FA.getCat();
 view(`<div class="ph"><div><h1>Tienda</h1><p>Productos que se ven en la página Tienda.</p></div><button class="b b-pri b-big" data-add>${I('plus')}Agregar producto</button></div>
 <div class="pg">${C.map(p=>`<article class="pc" aria-label="${esc(p.nombre)}"><div class="im"><img src="${esc(p.img||'assets/logo-frio-austral.png')}" alt="" loading="lazy">${p.visible?'':'<span class="hid">Oculto</span>'}</div><div class="bd"><b>${esc(p.nombre)}</b><span class="pr">${p.precio!=null&&p.precio!==''?clp(p.precio):'Sin precio'}</span>${p.categoria?`<span>${esc(p.categoria)}</span>`:''}</div><div class="ft"><button data-ed="${esc(p.id)}" aria-label="Editar ${esc(p.nombre)}">${I('edit')}</button><button data-vi="${esc(p.id)}" aria-label="${p.visible?'Ocultar':'Mostrar'} ${esc(p.nombre)}">${I(p.visible?'eyeoff':'eye')}</button><button data-dl="${esc(p.id)}" aria-label="Eliminar ${esc(p.nombre)}">${I('trash')}</button></div></article>`).join('')}
 <button class="add" data-add>${I('plus')}Agregar producto</button></div>
 ${C.length?'':`<div class="empty">${I('shop')}<b>La tienda está vacía</b><span>Agrega tu primer producto.</span></div>`}`);
 $$('[data-add]').forEach(b=>b.onclick=()=>pform());
 $$('[data-ed]').forEach(b=>b.onclick=()=>pform(b.dataset.ed));
 $$('[data-vi]').forEach(b=>b.onclick=()=>{const c=FA.getCat(),p=c.find(x=>x.id===b.dataset.vi);p.visible=!p.visible;FA.setCat(c);tienda();toast(p.visible?p.nombre+' ya se ve en la tienda':p.nombre+' quedó oculto',{undo:()=>{const c2=FA.getCat(),q=c2.find(x=>x.id===p.id);q.visible=!p.visible;FA.setCat(c2);tienda()}})});
 $$('[data-dl]').forEach(b=>b.onclick=async()=>{const c=FA.getCat(),i=c.findIndex(x=>x.id===b.dataset.dl),p=c[i];if(!await ask('¿Eliminar '+p.nombre+'?','Se quitará de la tienda. Podrás deshacerlo durante unos segundos.','Sí, eliminar',true))return;
  c.splice(i,1);FA.setCat(c);tienda();toast(p.nombre+' eliminado',{undo:()=>{const c2=FA.getCat();c2.splice(i,0,p);FA.setCat(c2);tienda()}})});
 if(id&&C.some(p=>p.id===id))pform(id)}
function pform(id){const c=FA.getCat(),ed=c.find(x=>x.id===id);let d=ed?{...ed}:(()=>{try{return JSON.parse(localStorage.getItem(PDK))}catch(e){return null}})()||{nombre:'',precio:null,categoria:'',desc:'',img:'',visible:true};
 const s=sheet(`<h2>${ed?'Editar producto':'Agregar producto'}</h2><form class="frm" id="pf" novalidate>
 <label class="f"><span>Nombre</span><input class="in" name="nombre" placeholder="Ej: Manómetro R134a" value="${esc(d.nombre)}" aria-describedby="e-n"><small class="ferr" id="e-n" hidden>Escribe el nombre del producto.</small></label>
 <div class="g2f"><label class="f"><span>Precio</span><input class="in" name="precio" inputmode="numeric" placeholder="Ej: $45.000" value="${d.precio!=null&&d.precio!==''?clp(d.precio):''}" aria-describedby="e-p h-p"><small id="h-p">Déjalo vacío si aún no tiene precio.</small><small class="ferr" id="e-p" hidden>Usa solo números.</small></label>
 <label class="f"><span>Categoría</span><input class="in" name="categoria" list="cats" placeholder="Ej: Herramientas" value="${esc(d.categoria)}"></label></div>
 <datalist id="cats"><option>Herramientas<option>Insumos<option>Repuestos<option>Medición</datalist>
 <label class="f"><span>Descripción <small>(opcional)</small></span><textarea class="in" name="desc" rows="3" placeholder="Ej: Juego de manómetros con mangueras de 1,5 m.">${esc(d.desc)}</textarea></label>
 <div class="f"><span>Foto</span><div class="drop" id="dz">${d.img?`<img src="${esc(d.img)}" alt="Foto del producto">`:I('upload')}<span>${d.img?'Esta es la foto actual.':'Arrastra una foto aquí o elige una opción.'}</span><div class="row"><button type="button" class="b b-sec" id="pg">${I('upload')}Elegir foto</button><button type="button" class="b b-sec" id="pcm">${I('cam')}Tomar foto</button></div></div>
  <input type="file" id="pfile" accept="image/*" hidden><input type="file" id="pcam" accept="image/*" capture="environment" hidden></div>
 <label class="chk"><input type="checkbox" name="visible" ${d.visible?'checked':''}> Mostrar en la tienda</label>
 <div class="acts"><button type="button" class="b b-sec" id="pcx">Cancelar</button><button class="b b-pri">${ed?'Guardar cambios':'Agregar a la tienda'}</button></div></form>`,{label:ed?'Editar producto':'Agregar producto'});
 const F=$('#pf',s),num=v=>{const x=String(v).replace(/\D/g,'');return x===''?null:Number(x)};
 const keep=()=>{d.nombre=F.nombre.value;d.precio=num(F.precio.value);d.categoria=F.categoria.value;d.desc=F.desc.value;d.visible=F.visible.checked;if(!ed)localStorage.setItem(PDK,JSON.stringify(d))};
 F.addEventListener('input',keep);
 F.precio.addEventListener('input',()=>{const raw=F.precio.value,n=num(raw),bad=/[^\d$.\s]/.test(raw);$('#e-p').hidden=!bad;F.precio.setAttribute('aria-invalid',String(bad));if(!bad)F.precio.value=n==null?'':clp(n)});
 F.nombre.addEventListener('input',()=>{if(F.nombre.value.trim()){$('#e-n').hidden=true;F.nombre.removeAttribute('aria-invalid')}});
 const setImg=async f=>{if(!f)return;if(!/^image\//.test(f.type))return toast('Ese archivo no es una foto.',{err:1});try{d.img=await shrink(f,800);keep();const z=$('#dz');$('svg,img',z)&&$('svg,img',z).replaceWith(Object.assign(document.createElement('img'),{src:d.img,alt:'Foto del producto'}));$('span',z).textContent='Foto lista.'}catch(e){toast('No pudimos leer esa foto.',{err:1})}};
 $('#pg').onclick=()=>$('#pfile').click();$('#pcm').onclick=()=>$('#pcam').click();
 $('#pfile').onchange=e=>setImg(e.target.files[0]);$('#pcam').onchange=e=>setImg(e.target.files[0]);
 const z=$('#dz');['dragenter','dragover'].forEach(t=>z.addEventListener(t,e=>{e.preventDefault();z.classList.add('ov')}));['dragleave','drop'].forEach(t=>z.addEventListener(t,e=>{e.preventDefault();z.classList.remove('ov')}));z.addEventListener('drop',e=>setImg(e.dataTransfer.files[0]));
 $('#pcx').onclick=()=>{closeSheet();if(!ed&&d.nombre)toast('Guardamos tu borrador para después')};
 F.onsubmit=e=>{e.preventDefault();keep();if(!d.nombre.trim()){$('#e-n').hidden=false;F.nombre.setAttribute('aria-invalid','true');F.nombre.focus();return}
  if(F.precio.getAttribute('aria-invalid')==='true'){F.precio.focus();return}
  const cat=FA.getCat(),o={nombre:d.nombre.trim(),precio:d.precio,categoria:d.categoria.trim(),desc:d.desc.trim(),img:d.img||'',visible:d.visible};
  if(ed){const i=cat.findIndex(x=>x.id===ed.id);cat[i]={...cat[i],...o}}else cat.push({id:'p'+Date.now(),...o});
  try{FA.setCat(cat)}catch(err){return toast('No hay espacio para esa foto. Usa una más liviana.',{err:1})}
  if(!ed)localStorage.removeItem(PDK);closeSheet();if(location.hash!=='#/tienda')location.hash='#/tienda';else tienda();toast(ed?'Cambios guardados':o.nombre+' ya está en la tienda')}}
/* ---------- Video portada ---------- */
let VD=null,VB=null,VU=null;
const frame=(s,mob)=>`<div class="hp ${mob?'hp-m':''}"><div class="m">${s?FA.media(s):'<img src="media/img/t2-gpic-960.webp" alt="">'}</div><div class="t"><p>Academia online · Video + PDF</p><p class="h4">Domina el aire acondicionado automotriz.</p><span class="fk">Ver cursos</span></div></div>`;
async function video(){const h=FA.getHero();
 view(`<div class="ph"><div><h1>Video portada</h1><p>El video grande que se ve al abrir la página de inicio.</p></div></div>
 <div class="st" id="vst">${I('video')}<span id="vtx">Cargando…</span></div>
 <div class="vg" style="margin:16px 0"><div><p style="color:var(--mut);margin-bottom:8px">En computador</p><div id="vpd"></div></div><div><p style="color:var(--mut);margin-bottom:8px">En celular</p><div id="vpm"></div></div></div>
 <div class="card frm"><div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="b b-pri b-big" id="vch">${I('upload')}Cambiar video</button><input type="file" id="vf" accept="video/mp4,video/webm,video/quicktime" hidden></div>
  <div id="vpr" hidden><p style="margin-bottom:6px" id="vpt">Preparando video…</p><div class="bar" role="progressbar" aria-label="Progreso del video" aria-valuemin="0" aria-valuemax="100"><i id="vbi"></i></div></div>
  <p class="ferr" id="verr" role="alert" hidden></p><p id="vwarn" class="note" style="margin:0" hidden></p>
  <details><summary style="min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700">Usar un link de YouTube o mp4</summary>
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><label class="sr" for="vu">Link del video</label><input class="in" id="vu" placeholder="Ej: https://youtu.be/…" style="flex:1 1 240px"><button class="b b-sec" id="vul">Ver cómo queda</button></div></details>
  <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end" id="vact" ${VD?'':'hidden'}><button class="b b-sec" id="vdc">Descartar</button><button class="b b-pri" id="vpb">Publicar en la portada</button></div>
  ${h?`<div><button class="b b-gh" id="vrs">Volver a la foto original</button></div>`:''}</div>`);
 const paint=async()=>{const s=VD||await FA.resolveHero();$('#vpd').innerHTML=frame(s);$('#vpm').innerHTML=frame(s,1);const H=FA.getHero();
  $('#vtx').textContent=(VD?'Estás viendo un video sin publicar. ':'')+'En la portada ahora: '+(H?(H.type==='file'?'video subido ('+(H.name||'archivo')+')':H.type==='yt'?'video de YouTube':'video por link'):'la foto original');$('#vact').hidden=!VD};
 const err=t=>{$('#verr').textContent=t||'';$('#verr').hidden=!t};
 $('#vch').onclick=()=>$('#vf').click();
 $('#vf').onchange=()=>{const f=$('#vf').files[0];if(!f)return;err();$('#vwarn').hidden=true;
  if(!/^video\/(mp4|webm|quicktime)$/.test(f.type))return err('Ese formato no sirve. Usa un video MP4, WEBM o MOV.');
  const mb=f.size/1048576;if(mb>40){$('#vwarn').hidden=false;$('#vwarn').innerHTML=I('alert')+`<span>El video pesa ${mb.toFixed(0)} MB. Puede cargar lento en celulares; lo ideal es menos de 20 MB.</span>`}
  const r=new FileReader();$('#vpr').hidden=false;$('#vpt').textContent='Preparando video…';
  r.onprogress=e=>{if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);$('#vbi').style.width=p+'%';$('#vpr .bar').setAttribute('aria-valuenow',p)}};
  r.onload=()=>{$('#vbi').style.width='100%';$('#vpt').textContent='Listo. Revisa cómo queda y toca Publicar.';if(VU)URL.revokeObjectURL(VU);VB=f;VU=URL.createObjectURL(f);VD={type:'file',url:VU,name:f.name};paint()};
  r.onerror=()=>err('No pudimos leer el video. Prueba con otro archivo.');r.readAsArrayBuffer(f)};
 $('#vul').onclick=()=>{const u=$('#vu').value.trim();err();if(!u)return err('Pega un link primero.');const id=FA.ytId(u);
  if(id)VD={type:'yt',id};else if(/^https:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(u))VD={type:'mp4',url:u};else return err('El link debe ser de YouTube o terminar en .mp4, y empezar con https.');VB=null;paint()};
 $('#vdc').onclick=()=>{VD=null;VB=null;$('#vf').value='';$('#vpr').hidden=true;paint();toast('Cambios descartados')};
 $('#vpb').onclick=async()=>{if(!VD)return;const prev=FA.getHero();
  try{if(VD.type==='file'){await FA.idbPut('hero',VB);localStorage.setItem(FA.HK,JSON.stringify({type:'file',ref:'hero',name:VD.name,at:Date.now()}))}else{localStorage.setItem(FA.HK,JSON.stringify({...VD,at:Date.now()}))}
   VD=null;VB=null;video();toast('Video publicado en la portada',{undo:prev&&prev.type!=='file'?()=>{localStorage.setItem(FA.HK,JSON.stringify(prev));video()}:!prev?()=>{localStorage.removeItem(FA.HK);video()}:null})}catch(e){err('No se pudo guardar el video en este navegador.')}};
 const rs=$('#vrs');rs&&(rs.onclick=async()=>{if(!await ask('¿Volver a la foto original?','La portada dejará de mostrar el video actual.','Sí, volver',true))return;const prev=FA.getHero();localStorage.removeItem(FA.HK);if(prev&&prev.type==='file')await FA.idbDel('hero').catch(()=>{});video();toast('La portada volvió a la foto original',{undo:prev&&prev.type!=='file'?()=>{localStorage.setItem(FA.HK,JSON.stringify(prev));video()}:null})});
 paint()}
/* ---------- Links ---------- */
function links(){const L=FA.getLinks();
 view(`<div class="ph"><div><h1>Links de venta</h1><p>A dónde lleva cada botón de compra del sitio.</p></div></div>
 <form class="lk" id="lkf" novalidate>${Object.keys(L).map(k=>`<div class="card lc" data-k="${esc(k)}"><div class="hd"><b>${esc(L[k].label)}</b></div>
  <div class="row"><label class="sr" for="l-${esc(k)}">Link de ${esc(L[k].label)}</label><input class="in" id="l-${esc(k)}" value="${esc(L[k].href)}" aria-describedby="le-${esc(k)}"><button type="button" class="b b-sec" data-cp>${I('copy')}Copiar</button><button type="button" class="b b-sec" data-ts>${I('ext')}Probar</button></div>
  <small class="ferr" id="le-${esc(k)}" hidden>El link debe empezar con https://</small>
  <label class="chk"><input type="checkbox" data-bl ${L[k].blank?'checked':''}> Abrir en una pestaña nueva</label></div>`).join('')}
  <div style="display:flex;justify-content:flex-end;position:sticky;bottom:84px;pointer-events:none"><button class="b b-pri b-big" style="pointer-events:auto;box-shadow:0 10px 30px -10px #000">Guardar links</button></div></form>`);
 const val=c=>{const k=c.dataset.k,inp=$('input.in',c),u=inp.value.trim(),bad=u!==FA.LINKS[k].href&&!FA.isHttps(u);$('.ferr',c).hidden=!bad;inp.setAttribute('aria-invalid',String(bad));return !bad};
 $$('.lc').forEach(c=>{$('input.in',c).addEventListener('input',()=>val(c));
  $('[data-cp]',c).onclick=async()=>{const u=$('input.in',c).value.trim();try{await navigator.clipboard.writeText(new URL(u,location.href).href);toast('Link copiado')}catch(e){const t=$('input.in',c);t.select();toast('Selecciona y copia el link manualmente',{err:1})}};
  $('[data-ts]',c).onclick=()=>{if(!val(c))return;window.open($('input.in',c).value.trim(),'_blank','noopener')}});
 $('#lkf').onsubmit=e=>{e.preventDefault();const cs=$$('.lc'),bad=cs.filter(c=>!val(c));if(bad.length){$('input.in',bad[0]).focus();return toast('Revisa los links marcados en rojo',{err:1})}
  const prev=localStorage.getItem(FA.LK),out={};cs.forEach(c=>{const k=c.dataset.k,u=$('input.in',c).value.trim();out[k]={blank:$('[data-bl]',c).checked};if(u!==FA.LINKS[k].href)out[k].href=u});
  FA.setLinks(out);toast('Links guardados',{undo:()=>{prev==null?FA.resetLinks():localStorage.setItem(FA.LK,prev);links()}})}}
/* ---------- Ajustes ---------- */
function ajustes(){const lt=document.documentElement.dataset.theme==='light';
 view(`<div class="ph"><div><h1>Ajustes</h1><p>Preferencias del panel.</p></div></div><div class="set">
 <section class="card"><h2>Apariencia</h2><label class="chk"><input type="checkbox" id="thm" ${lt?'checked':''}> Usar modo claro</label></section>
 <section class="card"><h2>Ayuda</h2><p>Vuelve a ver el recorrido de bienvenida.</p><div class="row"><button class="b b-sec" id="rtour">Ver recorrido</button></div></section>
 <section class="card"><h2>Herramientas de prueba</h2><p>Solo para la maqueta. Vuelven los datos de ejemplo y se borran los cambios hechos en este navegador.</p>
  <div class="row"><button class="b b-sec b-dan" id="rsd">Restablecer datos demo</button><button class="b b-sec b-dan" id="rsc">Restaurar catálogo inicial</button><button class="b b-sec b-dan" id="rsl">Restaurar links originales</button></div></section></div>`);
 $('#thm').onchange=e=>setTheme(e.target.checked?'light':'dark');$('#rtour').onclick=()=>tour(0);
 const R=(btn,key,t,msg,fn)=>$(btn).onclick=async()=>{if(!await ask(t,'Podrás deshacerlo durante unos segundos.','Sí, restablecer',true))return;const prev=localStorage.getItem(key);fn();counts();toast(msg,{undo:()=>{prev==null?localStorage.removeItem(key):localStorage.setItem(key,prev);counts()}})};
 R('#rsd',K,'¿Restablecer los datos de demostración?','Datos de demostración restablecidos',()=>localStorage.removeItem(K));
 R('#rsc',FA.CK,'¿Volver al catálogo inicial?','Catálogo restaurado',()=>FA.resetCat());
 R('#rsl',FA.LK,'¿Volver a los links originales?','Links restaurados',()=>FA.resetLinks())}
/* ---------- arranque ---------- */
/* ---------- Academia (cursos, módulos, lecciones y alumnos) · datos vía AcademiaData ---------- */
const AD=window.AcademiaData;
const ST={published:['Publicado','e-ok'],soon:['Próximamente','p-premium'],draft:['Borrador','e-bad']};
const stChip=s=>{const x=ST[s]||ST.draft;return `<span class="chip ${x[1]}">${x[0]}</span>`};
const demoChip='<span class="chip ac-demo">Contenido de ejemplo</span>';
const nLess=c=>c.modules.reduce((a,m)=>a+m.lessons.length,0);
const acTabs=t=>`<div class="flt" role="tablist" aria-label="Academia" style="margin-bottom:14px"><a role="tab" class="ac-tab" href="#/academia" aria-selected="${t==='c'}">Cursos</a><a role="tab" class="ac-tab" href="#/academia/alumnos" aria-selected="${t==='a'}">Alumnos</a></div>`;
async function academia(id){if(!AD){view('<div class="empty"><b>No se cargó la academia</b></div>');return}
 if(id==='alumnos')return acAlumnos();if(id&&id.startsWith('curso-'))return acCurso(id.slice(6));
 const C=await AD.admin.courses();
 view(`<div class="ph"><div><h1>Academia</h1><p>Cursos que se venden en la academia online. Los cambios se ven al tiro en la página Academia.</p></div><button class="b b-pri b-big" data-newc>${I('plus')}Nuevo curso</button></div>${acTabs('c')}
 <div class="ac-cl">${C.map(c=>`<article class="card ac-cc"><img src="${esc(c.cover||'assets/logo-frio-austral.png')}" alt="" loading="lazy"><div class="ac-ccb"><div class="ac-chips">${stChip(c.status)}${c.demo?demoChip:''}</div><b>${esc(c.title)}</b><small>${c.modules.length} módulos · ${nLess(c)} lecciones · ${c.price!=null&&c.price!==''?clp(c.price):'Precio por definir'}</small></div>
  <div class="ac-cca"><a class="b b-sec" href="#/academia/curso-${esc(c.id)}">${I('edit')}Editar</a></div></article>`).join('')||`<div class="empty">${I('cap')}<b>Todavía no hay cursos</b><span>Crea el primero con "Nuevo curso".</span></div>`}</div>
 <p style="color:var(--mut);font-size:14px;margin-top:16px">Modo demo: los cursos y alumnos se guardan en este navegador. El cobro es un pago de prueba hasta elegir la pasarela.</p>`);
 $$('[data-newc]').forEach(b=>b.onclick=async()=>{try{const n=await AD.admin.saveCourse({title:'Curso nuevo '+(C.length+1),status:'draft',modules:[]});location.hash='#/academia/curso-'+n.id;toast('Curso creado como borrador')}catch(e){toast(e.message,{err:1})}})}
async function acCurso(cid){const C=await AD.admin.courses(),c=C.find(x=>x.id===cid);if(!c){location.hash='#/academia';return}
 const put=async(nc,msg,undo)=>{try{await AD.admin.saveCourse(nc);acCurso(cid);msg&&toast(msg,undo?{undo}:{})}catch(e){toast(e.message,{err:1})}};
 const snap=JSON.parse(JSON.stringify(c));const undoTo=()=>{AD.admin.saveCourse(snap).then(()=>acCurso(cid))};
 view(`<div class="ph"><div><a class="b b-gh" href="#/academia" style="padding-left:0">${I('back')}Academia</a><h1 style="margin-top:6px">Editar curso</h1>${c.demo?`<p>${demoChip} Este curso trae lecciones de ejemplo con videos del sitio. Reemplázalas por las reales.</p>`:''}</div>
  <a class="b b-sec" href="academia.html?c=${esc(c.slug)}" target="_blank" rel="noopener">${I('ext')}Ver en la página</a></div>
 <form class="card frm ac-form" id="cf" novalidate>
  <label class="f"><span>Nombre del curso</span><input class="in" name="title" value="${esc(c.title)}" required></label>
  <label class="f"><span>Resumen corto</span><input class="in" name="short" value="${esc(c.short)}"></label>
  <label class="f"><span>Descripción</span><textarea class="in" name="description">${esc(c.description)}</textarea></label>
  <div class="ac-2"><label class="f"><span>Precio en pesos</span><input class="in" name="price" inputmode="numeric" value="${c.price??''}" placeholder="Vacío = Precio por definir"></label>
  <label class="f"><span>Estado</span><select class="in" name="status">${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${c.status===k?'selected':''}>${v[0]}</option>`).join('')}</select></label></div>
  <div class="ac-2"><label class="f"><span>Foto de portada (ruta o URL)</span><input class="in" name="cover" value="${esc(c.cover)}"></label>
  <label class="f"><span>Tráiler (URL del video)</span><input class="in" name="trailer" value="${esc(c.trailer)}"></label></div>
  <p class="ferr" id="cfe" hidden></p><div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="b b-pri">${I('check')}Guardar curso</button><button class="b b-dan" type="button" data-delc>${I('trash')}Eliminar curso</button></div></form>
 <div class="ph" style="margin:26px 0 12px"><div><h1 style="font-size:30px">Módulos y lecciones</h1><p>Usa las flechas para ordenar. Marca "Vista previa gratis" en las clases que cualquiera puede ver sin comprar.</p></div><button class="b b-pri" data-addm>${I('plus')}Agregar módulo</button></div>
 <div class="ac-mods">${c.modules.map((m,mi)=>`<section class="card ac-m"><div class="ac-mh"><b>${esc(m.title)}</b><span class="sp"></span>
  <button class="b b-gh b-ic" data-mup="${mi}" ${mi?'':'disabled'} aria-label="Subir módulo ${esc(m.title)}">↑</button><button class="b b-gh b-ic" data-mdn="${mi}" ${mi<c.modules.length-1?'':'disabled'} aria-label="Bajar módulo ${esc(m.title)}">↓</button>
  <button class="b b-gh b-ic" data-mren="${mi}" aria-label="Renombrar módulo ${esc(m.title)}">${I('edit')}</button><button class="b b-gh b-ic" data-mdel="${mi}" aria-label="Eliminar módulo ${esc(m.title)}">${I('trash')}</button></div>
  <ol class="ac-ll">${m.lessons.map((l,li)=>`<li><div class="ac-lt"><b>${esc(l.title)}</b><small>${l.preview?'<span class="chip e-ok">Vista previa gratis</span> ':''}${esc(l.video||'Sin video')}</small></div>
   <div class="ac-la"><button class="b b-gh b-ic" data-lup="${mi}:${li}" ${li?'':'disabled'} aria-label="Subir lección ${esc(l.title)}">↑</button><button class="b b-gh b-ic" data-ldn="${mi}:${li}" ${li<m.lessons.length-1?'':'disabled'} aria-label="Bajar lección ${esc(l.title)}">↓</button>
   <button class="b b-gh b-ic" data-led="${mi}:${li}" aria-label="Editar lección ${esc(l.title)}">${I('edit')}</button><button class="b b-gh b-ic" data-ldel="${mi}:${li}" aria-label="Eliminar lección ${esc(l.title)}">${I('trash')}</button></div></li>`).join('')||'<li style="color:var(--mut)">Este módulo no tiene lecciones.</li>'}</ol>
  <button class="b b-sec" data-addl="${mi}" style="margin-top:10px">${I('plus')}Agregar lección</button></section>`).join('')||`<div class="empty card">${I('cap')}<b>Sin módulos</b><span>Agrega el primer módulo del curso.</span></div>`}</div>`);
 $('#cf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),pr=String(f.get('price')||'').replace(/\D/g,'');
  try{await AD.admin.saveCourse({...c,title:String(f.get('title')).trim(),short:f.get('short'),description:f.get('description'),price:pr?+pr:null,status:f.get('status'),cover:f.get('cover'),trailer:f.get('trailer')});toast('Curso guardado');acCurso(cid)}
  catch(x){$('#cfe').textContent=x.message;$('#cfe').hidden=false}};
 $('[data-delc]').onclick=async()=>{if(!await ask('¿Eliminar este curso?','Se quitará de la academia. Podrás deshacerlo durante unos segundos.','Sí, eliminar',true))return;const all=await AD.admin.courses();await AD.admin.deleteCourse(cid);location.hash='#/academia';toast('Curso eliminado',{undo:()=>AD.admin.restoreCourses(all).then(()=>{location.hash='#/academia/curso-'+cid})})};
 const swap=(a,i,j)=>{[a[i],a[j]]=[a[j],a[i]]};
 $$('[data-mup]').forEach(b=>b.onclick=()=>{swap(c.modules,+b.dataset.mup,+b.dataset.mup-1);put(c,'Orden guardado')});
 $$('[data-mdn]').forEach(b=>b.onclick=()=>{swap(c.modules,+b.dataset.mdn,+b.dataset.mdn+1);put(c,'Orden guardado')});
 const mname=(t,cb)=>{const s=sheet(`<h2>${t}</h2><form id="mf" class="frm"><label class="f"><span>Nombre del módulo</span><input class="in" name="t" required></label><div class="acts"><button type="button" class="b b-sec" data-x>Cancelar</button><button class="b b-pri">Guardar</button></div></form>`,{label:t});
  $('[data-x]',s).onclick=closeSheet;return s};
 $$('[data-addm]').forEach(b=>b.onclick=()=>{const s=mname('Agregar módulo');$('[name=t]',s).value='Módulo '+(c.modules.length+1);$('#mf',s).onsubmit=e=>{e.preventDefault();const t=e.target.t.value.trim();if(!t)return;c.modules.push({id:AD.admin.newId('m'),title:t,lessons:[]});closeSheet();put(c,'Módulo agregado')}});
 $$('[data-mren]').forEach(b=>b.onclick=()=>{const m=c.modules[+b.dataset.mren],s=mname('Renombrar módulo');$('[name=t]',s).value=m.title;$('#mf',s).onsubmit=e=>{e.preventDefault();const t=e.target.t.value.trim();if(!t)return;m.title=t;closeSheet();put(c,'Módulo renombrado')}});
 $$('[data-mdel]').forEach(b=>b.onclick=async()=>{const m=c.modules[+b.dataset.mdel];if(!await ask('¿Eliminar '+m.title+'?','Se borran también sus '+m.lessons.length+' lecciones. Podrás deshacerlo durante unos segundos.','Sí, eliminar',true))return;c.modules.splice(+b.dataset.mdel,1);put(c,'Módulo eliminado',undoTo)});
 const ml=v=>v.split(':').map(Number);
 $$('[data-lup]').forEach(b=>b.onclick=()=>{const [m,l]=ml(b.dataset.lup);swap(c.modules[m].lessons,l,l-1);put(c,'Orden guardado')});
 $$('[data-ldn]').forEach(b=>b.onclick=()=>{const [m,l]=ml(b.dataset.ldn);swap(c.modules[m].lessons,l,l+1);put(c,'Orden guardado')});
 $$('[data-ldel]').forEach(b=>b.onclick=async()=>{const [m,l]=ml(b.dataset.ldel),x=c.modules[m].lessons[l];if(!await ask('¿Eliminar '+x.title+'?','Podrás deshacerlo durante unos segundos.','Sí, eliminar',true))return;c.modules[m].lessons.splice(l,1);put(c,'Lección eliminada',undoTo)});
 $$('[data-addl]').forEach(b=>b.onclick=()=>lform(c,+b.dataset.addl,-1,put));
 $$('[data-led]').forEach(b=>b.onclick=()=>{const [m,l]=ml(b.dataset.led);lform(c,m,l,put)})}
function lform(c,mi,li,put){const ed=li>=0?c.modules[mi].lessons[li]:null,d=ed||{title:'',description:'',video:'',poster:'',duration:0,preview:false,resources:[]};const r0=(d.resources||[])[0]||{title:'',url:''};
 const s=sheet(`<h2>${ed?'Editar lección':'Agregar lección'}</h2><form class="frm" id="lf2" novalidate>
 <label class="f"><span>Título</span><input class="in" name="title" value="${esc(d.title)}" required></label>
 <label class="f"><span>Descripción</span><textarea class="in" name="description">${esc(d.description)}</textarea></label>
 <label class="f"><span>URL del video</span><input class="in" name="video" value="${esc(d.video)}" placeholder="assets/video/... o link del proveedor de video"><small>Cuando se elija el hosting de video, aquí irá el video subido.</small></label>
 <div class="ac-2"><label class="f"><span>Duración (segundos)</span><input class="in" name="duration" inputmode="numeric" value="${d.duration||''}"></label><div class="f"><span>&nbsp;</span><button type="button" class="b b-sec" data-dur>Leer duración del video</button></div></div>
 <label class="f"><span>Imagen de portada del video (opcional)</span><input class="in" name="poster" value="${esc(d.poster||'')}"></label>
 <div class="ac-2"><label class="f"><span>Material: nombre</span><input class="in" name="rt" value="${esc(r0.title)}" placeholder="Ej: Guía en PDF"></label><label class="f"><span>Material: link del PDF</span><input class="in" name="ru" value="${esc(r0.url)}"></label></div>
 <label class="chk"><input type="checkbox" name="preview" ${d.preview?'checked':''}>Vista previa gratis (se ve sin comprar)</label>
 <p class="ferr" id="lfe" hidden></p><div class="acts"><button type="button" class="b b-sec" data-x>Cancelar</button><button class="b b-pri">Guardar lección</button></div></form>`,{label:'Lección'});
 $('[data-x]',s).onclick=closeSheet;
 $('[data-dur]',s).onclick=()=>{const u=$('[name=video]',s).value.trim();if(!u)return toast('Primero pon la URL del video',{err:1});const v=document.createElement('video');v.preload='metadata';v.muted=true;
  v.onloadedmetadata=()=>{$('[name=duration]',s).value=Math.round(v.duration);toast('Duración: '+Math.round(v.duration)+' s')};v.onerror=()=>toast('No se pudo leer ese video',{err:1});v.src=u};
 $('#lf2',s).onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),t=String(f.get('title')).trim();if(!t){$('#lfe',s).textContent='Escribe el título.';$('#lfe',s).hidden=false;return}
  const rt=String(f.get('rt')||'').trim(),ru=String(f.get('ru')||'').trim();
  const n={...d,id:d.id||AD.admin.newId('l'),title:t,description:f.get('description'),video:String(f.get('video')).trim(),poster:String(f.get('poster')).trim(),duration:+String(f.get('duration')).replace(/\D/g,'')||0,preview:!!f.get('preview'),resources:ru?[{title:rt||'Material (PDF)',url:ru}]:[]};
  ed?c.modules[mi].lessons[li]=n:c.modules[mi].lessons.push(n);closeSheet();put(c,ed?'Lección guardada':'Lección agregada')}}
let AQ='';
async function acAlumnos(){const S=await AD.admin.students();
 view(`<div class="ph"><div><h1>Academia</h1><p>Alumnos con cuenta en la academia, su avance y su acceso a cada curso.</p></div></div>${acTabs('a')}
 <div class="srch">${I('search')}<label class="sr" for="aq">Buscar alumno</label><input class="in" id="aq" type="search" placeholder="Buscar por nombre o correo" value="${esc(AQ)}"></div><div id="al"></div>`);
 const draw=()=>{const L=S.filter(s=>!AQ||(s.name+' '+s.email).toLowerCase().includes(AQ.toLowerCase()));
  $('#al').innerHTML=L.length?`<div class="ac-st">${L.map(s=>`<article class="card ac-s"><div class="ac-sh"><span class="av" aria-hidden="true">${esc(ini(s.name))}</span><div><b>${esc(s.name)}</b><small>${esc(s.email)}</small></div></div>
   ${s.courses.filter(c=>c.status!=='none'||true).map(c=>`<div class="ac-sc"><div class="ac-sct"><span>${esc(c.title)}</span>${c.status==='active'?`<span class="chip e-ok">${I('check')}Con acceso${c.source==='manual'?' (manual)':''}</span>`:c.status==='revoked'?`<span class="chip e-bad">Acceso quitado</span>`:'<span class="chip">Sin compra</span>'}</div>
   ${c.status==='active'?`<div class="ac-bar2" aria-label="Avance ${c.progress.pct}%"><i style="width:${c.progress.pct}%"></i></div><small>${c.progress.done} de ${c.progress.total} lecciones · ${c.progress.pct}%</small>`:''}
   <div>${c.status==='active'?`<button class="b b-sec" data-off="${esc(s.id)}|${esc(c.id)}">${I('pause')}Quitar acceso</button>`:`<button class="b b-sec" data-on="${esc(s.id)}|${esc(c.id)}">${I('play')}Dar acceso</button>`}</div></div>`).join('')}</article>`).join('')}</div>`
  :`<div class="empty card">${I('users')}<b>${S.length?'No hay alumnos con esa búsqueda':'Todavía no hay alumnos'}</b><span>${S.length?'Prueba con otro nombre.':'Cuando alguien cree su cuenta en la academia aparecerá aquí.'}</span></div>`;
  $$('[data-on]').forEach(b=>b.onclick=async()=>{const [u,c]=b.dataset.on.split('|');await AD.admin.setAccess(u,c,true);toast('Acceso dado',{undo:()=>AD.admin.setAccess(u,c,false).then(acAlumnos)});acAlumnos()});
  $$('[data-off]').forEach(b=>b.onclick=async()=>{const [u,c]=b.dataset.off.split('|');if(!await ask('¿Quitar el acceso?','La persona ya no podrá ver las lecciones de este curso (su avance se guarda).','Sí, quitar',true))return;await AD.admin.setAccess(u,c,false);toast('Acceso quitado',{undo:()=>AD.admin.setAccess(u,c,true).then(acAlumnos)});acAlumnos()})};
 draw();$('#aq').oninput=e=>{AQ=e.target.value;draw()}}

function boot(){route()}
const th=localStorage.getItem('fa_admin_theme');if(th)document.documentElement.dataset.theme=th;
addEventListener('hashchange',()=>{closeSheet();route();const v=$('#view');v&&v.focus({preventScroll:true});scrollTo(0,0)});
addEventListener('storage',e=>{if(e.key===K&&logged()&&!$('#sheet'))route()});
boot();
})();
