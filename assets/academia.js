/* Academia FrÃ­o Austral Â· UI (usa solo window.AcademiaData) */
(function(){
'use strict';
const A=window.AcademiaData,page=document.body.dataset.ac,root=document.getElementById('ac');
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const Q=new URLSearchParams(location.search);
const clp=n=>'$'+Number(n).toLocaleString('es-CL');
const price=c=>c.price!=null&&c.price!==''?`${c.oldPrice?`<span>Antes <s>${clp(c.oldPrice)}</s> Â· ahora</span>`:''}<b>${clp(c.price)}</b>`:'<b>Precio por definir</b>';
const mmss=s=>{s=Math.max(0,Math.floor(s||0));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${x}`:`${m}:${x}`};
const first=n=>String(n||'').trim().split(/\s+/)[0];
const IC={lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
 check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
 play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>',
 info:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5h.01"/></svg>',
 file:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 12v6M9 15l3 3 3-3"/></svg>',
 back:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 17 6 12l5-5M18 17l-5-5 5-5"/></svg>',fwd:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg>',
 fs:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'};
function toast(m){const t=document.createElement('div');t.className='ac-toast';t.setAttribute('role','status');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3200)}
let lastFocus=null;
function modal(html,label){closeModal();lastFocus=document.activeElement;const m=document.createElement('div');m.className='ac-modal';m.id='acModal';
 m.innerHTML=`<div class="ac-dlg" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;document.body.append(m);
 m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-close]'))closeModal()});const f=$('button,a,input',m);f&&f.focus();return $('.ac-dlg',m)}
function closeModal(){const m=$('#acModal');if(m){m.remove();lastFocus&&lastFocus.focus&&lastFocus.focus()}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
/* destino despuÃ©s de ingresar: solo pÃ¡ginas propias de la lista y parÃ¡metros conocidos (evita open redirect) */
const PAGES=['academia.html','mi-academia.html','leccion.html','certificado.html'],KEYS=['c','l','comprar'];
function safeNext(n){let u;try{u=new URL(String(n||''),location.href)}catch(e){return PAGES[0]}
 if(u.origin!==location.origin)return PAGES[0];const i=PAGES.indexOf(u.pathname.split('/').pop());if(i<0)return PAGES[0];
 const q=KEYS.map(k=>{const v=u.searchParams.get(k);return v&&/^[\w-]{1,80}$/.test(v)?k+'='+v.replace(/[^\w-]/g,''):''}).filter(Boolean).join('&');
 return PAGES[i]+(q?'?'+q:'')}
/* el destino post-login viaja en sessionStorage, no en la URL (sin open redirect) */
const goLogin=next=>{sessionStorage.setItem('fa_ac_next',safeNext(next||location.pathname.split('/').pop()+location.search));location.href='ingresar.html'};
const set=h=>{root.innerHTML=h;root.setAttribute('aria-busy','false')};
const lessons=c=>c.modules.flatMap(m=>m.lessons);
const dur=l=>l.duration?mmss(l.duration):'';
/* temario en acordeÃ³n */
function toc(c,{current,allProgress={},enrolled}){return `<div class="ac-toc">${c.modules.map((m,i)=>{const has=m.lessons.some(l=>l.id===current);const dn=m.lessons.filter(l=>(allProgress[l.id]||{}).done).length;
 return `<details class="ac-mod" ${has||(!current&&i===0)?'open':''}><summary>${esc(m.title)}<small>${enrolled?`${dn}/${m.lessons.length}`:m.lessons.length+' lecciones'}</small></summary><ul class="ac-ls">${m.lessons.map(l=>{
  const can=enrolled||l.preview,done=(allProgress[l.id]||{}).done,ic=done?`<span class="ac-ic ok" aria-label="Completada">${IC.check}</span>`:can?`<span class="ac-ic" aria-hidden="true">${IC.play}</span>`:`<span class="ac-ic" aria-label="Bloqueada">${IC.lock}</span>`;
  const inner=`${ic}<span class="t">${esc(l.title)}</span>${!enrolled&&l.preview?'<span class="ac-free">Gratis</span>':''}<span class="d">${dur(l)}</span>`;
  return `<li>${can?`<a href="leccion.html?c=${encodeURIComponent(c.slug)}&l=${encodeURIComponent(l.id)}" ${l.id===current?'aria-current="page"':''}>${inner}</a>`:`<span class="lk">${inner}</span>`}</li>`}).join('')}</ul></details>`}).join('')}</div>`}
/* compra demo */
async function buy(slug){const u=await A.auth.current();if(!u)return goLogin('academia.html?c='+slug+'&comprar=1');
 const c=await A.catalog.get(slug);if(!c)return;if(c.enrolled)return location.href='leccion.html?c='+encodeURIComponent(slug)+'&l='+encodeURIComponent(lessons(c)[0].id);
 const d=modal(`<span class="ac-test">Pago de prueba</span><h2>Comprar curso</h2><p class="ac-p"><b>${esc(c.title)}</b></p>
  <div class="ac-price" style="margin:0">${price(c)}<span>Pago Ãºnico</span></div>
  <p class="ac-hint">Esto es una demo: no se cobra nada ni se piden datos de tarjeta. Al confirmar, el curso queda en tu cuenta (${esc(u.email)}).</p>
  <div class="ac-acts"><button class="btn btn-line" data-close type="button">Cancelar</button><button class="btn btn-red" id="acPay" type="button">Confirmar pago de prueba</button></div>`,'Pago de prueba');
 $('#acPay',d).onclick=async()=>{const b=$('#acPay',d);b.disabled=true;b.textContent='Procesandoâ€¦';
  try{await A.enrollments.purchaseDemo(slug)}catch(e){b.disabled=false;b.textContent='Confirmar pago de prueba';toast(e.message);return}
  const first=lessons(c)[0];modal(`<span class="ac-test">Pago de prueba aprobado</span><h2>Â¡Listo, ya tienes el curso!</h2><p class="ac-p">Lo encuentras siempre en <b>Academia</b>, con el temario completo y tu avance. Puedes verlo desde el celular o el computador.</p>
   <div class="ac-acts"><a class="btn btn-line" href="academia.html">Ver mi temario</a><a class="btn btn-red" id="acStart" href="leccion.html?c=${encodeURIComponent(slug)}&l=${encodeURIComponent(first.id)}">Empezar el curso</a></div>`,'Compra lista')}}


const outBtn=()=>$$('[data-out]').forEach(b=>b.onclick=async()=>{await A.auth.logout();location.href='academia.html'});
/* ---------- mi aprendizaje (curso comprado): temario completo con avance ---------- */
async function aprender(u,mine,otros){
 const data=await Promise.all(mine.map(async m=>{const c=await A.catalog.get(m.course.slug);const r=m.continueLesson?await A.catalog.lesson(m.course.slug,m.continueLesson.id):{};return {m,c,ap:(r&&r.allProgress)||{}}}));
 set(`<section class="wrap ac-sec" style="padding-top:8px"><p class="ac-crumb"><a href="index.html">Inicio</a> / Academia</p>
 <div class="ac-learn-top"><h1 class="ac-h1" style="margin-top:10px;font-size:clamp(36px,6vw,64px)">Mi <span class="ice-text">aprendizaje</span></h1>
 <p class="ac-hello">Hola, <b>${esc(first(u.name))}</b>. <a class="ac-link" href="mi-academia.html#cuenta">Mi cuenta</a> Â· <button class="ac-link" type="button" data-out>Cerrar sesiÃ³n</button></p></div>
 ${data.map(({m,c,ap})=>{const pg=m.progress,cl=m.continueLesson,ls=lessons(c),fin=pg.pct===100;
  return `<div class="ac-learn"><aside class="ac-learn-card glass"><div class="ac-cover"><img src="${esc(c.cover)}" alt="" loading="lazy"></div><div class="ac-b">
   <h2 class="ac-h3">${esc(c.title)}</h2>
   <div class="ac-bar" role="progressbar" aria-label="Avance del curso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pg.pct}"><i style="width:${pg.pct}%"></i></div>
   <p class="ac-pt"><span>${pg.done} de ${pg.total} lecciones</span><b>${pg.pct}%</b></p>
   ${cl&&!fin?`<p class="ac-hint">${m.started?'Continuar donde quedaste:':'Primera lecciÃ³n:'} <b>${esc(cl.title)}</b></p>`:''}
   <div class="ac-acts">${cl?`<a class="btn btn-red" href="leccion.html?c=${encodeURIComponent(c.slug)}&l=${encodeURIComponent(cl.id)}">${fin?'Volver a ver':m.started?'Continuar donde quedaste':'Empezar curso'} <span class="btn-arr" aria-hidden="true">â†’</span></a>`:''}
   ${fin?`<a class="btn btn-line" href="certificado.html?c=${encodeURIComponent(c.slug)}">Ver certificado</a>`:''}</div>
   <p class="ac-hint">${c.modules.length} mÃ³dulos Â· ${ls.length} lecciones</p></div></aside>
   <div class="ac-learn-toc"><h2 class="ac-h2" style="font-size:28px;margin:0 0 12px">Temario del curso</h2>${toc(c,{current:cl&&cl.id,allProgress:ap,enrolled:true})}</div></div>`}).join('')}
 ${otros.filter(c=>c.status!=='draft').length?`<h2 class="ac-h2" style="margin-top:40px;font-size:28px">Otros cursos</h2><div class="ac-grid">${otros.map(c=>`<article class="ac-card glass"><div class="ac-cover"><img src="${esc(c.cover||'assets/logo-frio-austral.png')}" alt="" loading="lazy">${c.status==='soon'?'<span class="ac-badge red">PrÃ³ximamente</span>':''}</div><div class="ac-b"><h3>${esc(c.title)}</h3><p class="ac-p">${esc(c.short)}</p>${c.status==='soon'?'<div class="ac-acts"><button class="btn btn-line" type="button" disabled>PrÃ³ximamente</button></div>':`<div class="ac-acts"><a class="btn btn-line" href="academia.html?c=${encodeURIComponent(c.slug)}">Ver temario</a><button class="btn btn-red" type="button" data-buy="${esc(c.slug)}">Comprar curso</button></div>`}</div></article>`).join('')}</div>`:''}
 </section>`);
 $$('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));outBtn()}
/* ---------- catÃ¡logo ---------- */
async function catalogo(){const slug=Q.get('c');if(slug)return detalle(slug);
 const L=await A.catalog.list(),u=await A.auth.current();
 /* flujo tipo Platzi/Udemy: sin sesiÃ³n -> login; con curso -> temario; sin curso -> catÃ¡logo para comprar */
 if(!u)return goLogin('academia.html');
 const mine=await A.enrollments.mine();const has=id=>mine.some(m=>m.course.id===id);
 if(mine.length&&Q.get('ver')!=='cursos')return aprender(u,mine,L.filter(c=>!has(c.id)));
 set(`<section class="wrap ac-sec" style="padding-top:8px"><p class="ac-crumb"><a href="index.html">Inicio</a> / Academia</p>
  <h1 class="ac-h1" style="margin-top:10px">Academia <span class="ice-text">online</span></h1>
  <p class="ac-hello">Hola, <b>${esc(first(u.name))}</b>. TodavÃ­a no tienes cursos: elige uno para empezar. <button class="ac-link" type="button" data-out>Cerrar sesiÃ³n</button></p>
  <p class="ac-lead">Compra el curso aquÃ­ y mÃ­ralo en tu cuenta, desde el celular o el computador. <b>Pago Ãºnico.</b></p>
  <div class="ac-grid">${L.map(c=>{const soon=c.status==='soon',own=has(c.id);return `<article class="ac-card glass" id="curso-${esc(c.slug)}">
   <div class="ac-cover"><img src="${esc(c.cover||'assets/logo-frio-austral.png')}" alt="" loading="lazy">${soon?'<span class="ac-badge red">PrÃ³ximamente</span>':own?'<span class="ac-badge">Ya es tuyo</span>':''}</div>
   <div class="ac-b"><h3>${esc(c.title)}</h3><p class="ac-p">${esc(c.short)}</p>
   ${soon?'<div class="ac-price"><b>PrÃ³ximamente</b><span>Te avisamos cuando estÃ© disponible</span></div><div class="ac-acts"><button class="btn btn-line" type="button" disabled>PrÃ³ximamente</button></div>'
   :`<div class="ac-price">${price(c)}<span>Pago Ãºnico Â· ${lessons(c).length} lecciones</span></div>
   <div class="ac-acts"><a class="btn btn-line" href="academia.html?c=${encodeURIComponent(c.slug)}">Ver temario</a>${own?`<a class="btn btn-red" href="academia.html">Ir al curso</a>`:`<button class="btn btn-red" type="button" data-buy="${esc(c.slug)}">Comprar curso</button>`}</div>`}</div></article>`}).join('')}</div></section>`);
 $$('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));outBtn()}
async function detalle(slug){const c=await A.catalog.get(slug);if(!c){set(`<section class="wrap ac-sec"><div class="ac-empty glass"><h1 class="ac-h2">No encontramos ese curso</h1><a class="btn btn-red" href="academia.html">Ver la academia</a></div></section>`);return}
 document.title=c.title+' Â· Academia FrÃ­o Austral';const soon=c.status==='soon',ls=lessons(c),fr=ls.find(l=>l.preview);
 set(`<section class="wrap ac-sec" style="padding-top:8px"><p class="ac-crumb"><a href="index.html">Inicio</a> / <a href="academia.html">Academia</a> / Curso</p>
 <div class="ac-det"><div><h1 class="ac-h2" style="margin-top:10px">${esc(c.title)}</h1><p class="ac-lead">${esc(c.description)}</p>
  <div class="ac-media" style="margin-top:18px">${c.trailer?`<video controls playsinline preload="none" poster="${esc(c.trailerPoster)}" aria-label="TrÃ¡iler del curso"><source src="${esc(c.trailer)}" type="video/mp4"></video>`:`<img src="${esc(c.cover)}" alt="">`}</div>
  ${ls.length?`<h2 class="ac-h2" style="font-size:30px;margin:28px 0 12px">Temario</h2>${toc(c,{enrolled:c.enrolled,allProgress:{}})}`:'<div class="ac-note" style="margin-top:22px">'+IC.info+'<span>El temario se publicarÃ¡ cuando el curso estÃ© disponible.</span></div>'}</div>
  <aside class="ac-buy glass">${soon?'<span class="ac-badge red" style="position:static;width:max-content">PrÃ³ximamente</span>':''}<div class="ac-price" style="padding:0">${soon?'<b>PrÃ³ximamente</b>':price(c)}</div>
   <ul><li>Pago Ãºnico</li><li>Videos grabados + material PDF</li><li>Tuyo para siempre, a tu ritmo</li><li>Certificado al completar el curso</li></ul>
   ${soon?'<button class="btn btn-line" type="button" disabled>PrÃ³ximamente</button>':c.enrolled?`<a class="btn btn-red" href="academia.html">Ir a mi curso</a>`:`<button class="btn btn-red" type="button" data-buy="${esc(c.slug)}">Comprar curso</button>${fr?`<a class="btn btn-line" href="leccion.html?c=${encodeURIComponent(c.slug)}&l=${encodeURIComponent(fr.id)}">Ver clase gratis</a>`:''}`}</aside></div></section>`);
 $$('[data-buy]').forEach(b=>b.onclick=()=>buy(b.dataset.buy));
 if(Q.get('comprar')==='1'&&!soon&&!c.enrolled&&await A.auth.current())buy(slug)}

/* ---------- ingresar ---------- */
async function ingresar(){const next=safeNext(sessionStorage.getItem('fa_ac_next')),hash=new URLSearchParams(location.hash.slice(1));
 if(hash.get('reset'))return resetView(hash.get('reset'));
 if(await A.auth.current()){sessionStorage.removeItem('fa_ac_next');location.replace(next);return}
 const pw=(n,ac)=>`<div class="ac-pw"><input class="ac-in" name="${n}" type="password" autocomplete="${ac}" required minlength="${ac==='new-password'?8:1}"><button type="button" data-eye aria-label="Mostrar contraseÃ±a">Mostrar</button></div>`;
 set(`<section class="wrap ac-sec"><div class="ac-auth glass"><h1 class="ac-h2" style="text-align:center">Academia FrÃ­o Austral</h1>
  <div class="ac-tabs" role="tablist" aria-label="Ingresar o crear cuenta"><button role="tab" id="tIn" aria-controls="fIn" aria-selected="true" type="button">Ingresar</button><button role="tab" id="tUp" aria-controls="fUp" aria-selected="false" type="button">Crear cuenta</button></div>
  <form id="fIn" role="tabpanel" aria-labelledby="tIn" class="ac-auth" style="padding:0;max-width:none" novalidate>
   <label class="ac-f"><span>Email</span><input class="ac-in" name="email" type="email" inputmode="email" autocomplete="email" required></label>
   <label class="ac-f"><span>ContraseÃ±a</span>${pw('password','current-password')}</label>
   <p class="ac-err" role="alert" hidden></p><button class="btn btn-red" type="submit">Ingresar</button>
   <button class="ac-link" type="button" data-forgot>Â¿Olvidaste tu contraseÃ±a?</button></form>
  <form id="fUp" role="tabpanel" aria-labelledby="tUp" class="ac-auth" style="padding:0;max-width:none" hidden novalidate>
   <label class="ac-f"><span>Nombre</span><input class="ac-in" name="name" autocomplete="name" required></label>
   <label class="ac-f"><span>Email</span><input class="ac-in" name="email" type="email" inputmode="email" autocomplete="email" required></label>
   <label class="ac-f"><span>ContraseÃ±a</span>${pw('password','new-password')}<small class="ac-hint">MÃ­nimo 8 caracteres.</small></label>
   <p class="ac-err" role="alert" hidden></p><button class="btn btn-red" type="submit">Crear mi cuenta</button>
   <p class="ac-hint">Crear la cuenta es gratis. Solo pagas si compras un curso.</p></form>
  <form id="fRe" class="ac-auth" style="padding:0;max-width:none" hidden novalidate><h2 style="font-size:20px">Recuperar contraseÃ±a</h2><p class="ac-hint">Escribe tu email y te enviaremos un link para crear una nueva contraseÃ±a.</p>
   <label class="ac-f"><span>Email</span><input class="ac-in" name="email" type="email" autocomplete="email" required></label>
   <p class="ac-err" role="alert" hidden></p><div id="reOut" role="status"></div><button class="btn btn-red" type="submit">Enviar link</button><button class="ac-link" type="button" data-back>Volver a ingresar</button></form>
 </div></section>`);
 const tabs=$$('[role=tab]'),forms={tIn:$('#fIn'),tUp:$('#fUp')};
 const show=id=>{tabs.forEach(t=>t.setAttribute('aria-selected',String(t.id===id)));Object.entries(forms).forEach(([k,f])=>f.hidden=k!==id);$('#fRe').hidden=true;$('.ac-tabs').hidden=false;const f=forms[id];$('input',f).focus()};
 tabs.forEach(t=>t.onclick=()=>show(t.id));if(Q.get('modo')==='crear')show('tUp');
 $$('[data-eye]').forEach(b=>b.onclick=()=>{const i=b.previousElementSibling,v=i.type==='password';i.type=v?'text':'password';b.textContent=v?'Ocultar':'Mostrar';b.setAttribute('aria-label',v?'Ocultar contraseÃ±a':'Mostrar contraseÃ±a')});
 const err=(f,m)=>{const e=$('.ac-err',f);e.textContent=m;e.hidden=!m};
 $('#fIn').onsubmit=async e=>{e.preventDefault();const f=e.target,d=new FormData(f);if(!d.get('email')||!d.get('password'))return err(f,'Escribe tu email y tu contraseÃ±a.');
  try{await A.auth.login({email:d.get('email'),password:d.get('password')});sessionStorage.removeItem('fa_ac_next');location.href=next}catch(x){err(f,x.message);f.password.value='';f.password.focus()}};
 $('#fUp').onsubmit=async e=>{e.preventDefault();const f=e.target,d=new FormData(f);
  try{await A.auth.register({name:d.get('name'),email:d.get('email'),password:d.get('password')});sessionStorage.removeItem('fa_ac_next');location.href=next}catch(x){err(f,x.message)}};
 $('[data-forgot]').onclick=()=>{forms.tIn.hidden=forms.tUp.hidden=true;$('.ac-tabs').hidden=true;$('#fRe').hidden=false;$('#fRe input').value=$('#fIn input[name=email]').value;$('#fRe input').focus()};
 $('[data-back]').onclick=()=>show('tIn');
 $('#fRe').onsubmit=async e=>{e.preventDefault();const f=e.target,em=new FormData(f).get('email');if(!em)return err(f,'Escribe tu email.');err(f,'');
  const r=await A.auth.requestReset(em);$('#reOut').innerHTML=`<p class="ac-ok">Si el email tiene cuenta, te llegarÃ¡ un link para crear una nueva contraseÃ±a.</p>${r.demoToken?`<p class="ac-hint" style="margin-top:8px">Modo demo: no se envÃ­an emails. Usa este botÃ³n como si fuera el link del email.</p><a class="btn btn-line" style="margin-top:8px;width:100%" href="ingresar.html#reset=${encodeURIComponent(r.demoToken)}" data-reset>Abrir link de recuperaciÃ³n (demo)</a>`:''}`;
  const a=$('[data-reset]');a&&(a.onclick=ev=>{ev.preventDefault();history.replaceState(null,'',a.getAttribute('href'));resetView(r.demoToken)})}}
function resetView(tok){set(`<section class="wrap ac-sec"><form class="ac-auth glass" id="fNp" novalidate><h1 class="ac-h2" style="text-align:center">Nueva contraseÃ±a</h1>
 <label class="ac-f"><span>Nueva contraseÃ±a</span><input class="ac-in" name="p1" type="password" autocomplete="new-password" required minlength="8"><small class="ac-hint">MÃ­nimo 8 caracteres.</small></label>
 <label class="ac-f"><span>Repite la contraseÃ±a</span><input class="ac-in" name="p2" type="password" autocomplete="new-password" required></label>
 <p class="ac-err" role="alert" hidden></p><button class="btn btn-red" type="submit">Guardar contraseÃ±a</button></form></section>`);
 $('#fNp').onsubmit=async e=>{e.preventDefault();const f=e.target,d=new FormData(f),er=$('.ac-err',f);
  if(d.get('p1')!==d.get('p2')){er.textContent='Las contraseÃ±as no coinciden.';er.hidden=false;return}
  try{await A.auth.resetPassword(tok,d.get('p1'));history.replaceState(null,'','ingresar.html');set(`<section class="wrap ac-sec"><div class="ac-auth glass" style="text-align:center"><h1 class="ac-h2">ContraseÃ±a cambiada</h1><p class="ac-p">Ya puedes ingresar con tu nueva contraseÃ±a.</p><a class="btn btn-red" href="ingresar.html">Ingresar</a></div></section>`)}
  catch(x){er.textContent=x.message;er.hidden=false}}}

/* ---------- mi academia ---------- */
async function mis(){const u=await A.auth.current();if(!u)return goLogin('mi-academia.html');
 const [M,sub]=await Promise.all([A.enrollments.mine(),A.subscription.forMe()]);
 set(`<section class="wrap ac-sec" style="padding-top:8px"><p class="ac-crumb"><a href="index.html">Inicio</a> / Mi academia</p>
 <h1 class="ac-h1" style="margin-top:10px;font-size:clamp(38px,7vw,70px)">Hola, <span class="ice-text">${esc(first(u.name))}</span></h1>
 <h2 class="ac-h2" style="margin-top:28px;font-size:30px">Mis cursos</h2>
 <div class="ac-my">${M.length?M.map(m=>`<article class="ac-mc glass"><div class="ac-cover"><img src="${esc(m.course.cover)}" alt="" loading="lazy"></div><div class="ac-b">
  <h3>${esc(m.course.title)}</h3><div class="ac-bar" role="progressbar" aria-label="Avance del curso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.progress.pct}"><i style="width:${m.progress.pct}%"></i></div>
  <p class="ac-pt"><span>${m.progress.done} de ${m.progress.total} lecciones</span><b>${m.progress.pct}%</b></p>
  ${m.continueLesson?`<p class="ac-hint">${m.progress.pct===100?'Curso completado':m.started?'Continuar donde quedaste: ':'Primera lecciÃ³n: '}${m.progress.pct===100?'':'<b>'+esc(m.continueLesson.title)+'</b>'}</p>`:''}
  <div class="ac-acts">${m.continueLesson?`<a class="btn btn-red" href="leccion.html?c=${encodeURIComponent(m.course.slug)}&l=${encodeURIComponent(m.continueLesson.id)}">${m.progress.pct===100?'Volver a ver':m.started?'Continuar donde quedaste':'Empezar curso'} <i>â†’</i></a>`:''}
  ${m.progress.pct===100?`<a class="btn btn-line" href="certificado.html?c=${encodeURIComponent(m.course.slug)}">Ver certificado</a>`:''}</div></div></article>`).join('')
  :`<div class="ac-empty glass"><b style="font-size:20px">TodavÃ­a no tienes cursos</b><p class="ac-p">Cuando compres un curso aparecerÃ¡ aquÃ­, con tu avance.</p><a class="btn btn-red" href="academia.html">Ver cursos de la academia</a></div>`}</div>
 ${sub&&sub.active?`<div class="ac-note" style="margin-top:22px">${IC.info}<span>Tu suscripciÃ³n para preguntas estÃ¡ activa. <a class="ac-link" style="min-height:0" href="consultas.html">Ir a Mis consultas</a></span></div>`:''}
 <h2 class="ac-h2" id="cuenta" style="margin-top:36px;font-size:30px">Mi cuenta</h2>
 <div class="ac-acc"><form class="ac-box glass" id="fPr" novalidate><h3>Mis datos</h3>
  <label class="ac-f"><span>Nombre (sale en el certificado)</span><input class="ac-in" name="name" value="${esc(u.name)}" autocomplete="name" required></label>
  <label class="ac-f"><span>Email</span><input class="ac-in" value="${esc(u.email)}" readonly aria-readonly="true"></label>
  <p class="ac-err" role="alert" hidden></p><button class="btn btn-red" type="submit">Guardar</button></form>
  <form class="ac-box glass" id="fPw" novalidate><h3>Cambiar contraseÃ±a</h3>
  <label class="ac-f"><span>ContraseÃ±a actual</span><input class="ac-in" name="o" type="password" autocomplete="current-password" required></label>
  <label class="ac-f"><span>Nueva contraseÃ±a</span><input class="ac-in" name="n" type="password" autocomplete="new-password" required minlength="8"><small class="ac-hint">MÃ­nimo 8 caracteres.</small></label>
  <p class="ac-err" role="alert" hidden></p><button class="btn btn-line" type="submit">Cambiar contraseÃ±a</button></form></div>
 <div class="ac-acts" style="margin-top:20px"><button class="btn btn-line" type="button" id="acOut" style="flex:0 1 auto">Cerrar sesiÃ³n</button></div></section>`);
 const er=(f,m)=>{const e=$('.ac-err',f);e.textContent=m;e.hidden=!m};
 $('#fPr').onsubmit=async e=>{e.preventDefault();try{await A.auth.updateProfile({name:e.target.name.value});er(e.target,'');toast('Datos guardados')}catch(x){er(e.target,x.message)}};
 $('#fPw').onsubmit=async e=>{e.preventDefault();const f=e.target;try{await A.auth.changePassword(f.o.value,f.n.value);f.reset();er(f,'');toast('ContraseÃ±a cambiada')}catch(x){er(f,x.message)}};
 $('#acOut').onclick=async()=>{await A.auth.logout();location.href='index.html'}}

/* ---------- lecciÃ³n ---------- */
async function leccion(){const slug=Q.get('c')||'',lid=Q.get('l')||'';const r=await A.catalog.lesson(slug,lid);
 if(r.error){document.title='LecciÃ³n bloqueada Â· Academia FrÃ­o Austral';const back=`academia.html?c=${encodeURIComponent(slug)}`;
  set(`<section class="wrap ac-sec"><div class="ac-empty glass" style="max-width:620px;margin:0 auto">${r.error==='notfound'?'<h1 class="ac-h2">No encontramos esa lecciÃ³n</h1><a class="btn btn-red" href="academia.html">Ver la academia</a>'
  :`<span class="ac-ic" style="width:56px;height:56px">${IC.lock}</span><h1 class="ac-h2">Esta lecciÃ³n es para alumnos del curso</h1><p class="ac-p">${r.error==='nologin'?'Ingresa con tu cuenta si ya compraste el curso, o cÃ³mpralo para verla.':'Tu cuenta todavÃ­a no tiene este curso. CÃ³mpralo para ver todas las lecciones.'}</p>
  <div class="ac-acts" style="width:100%">${r.error==='nologin'?`<button class="btn btn-line" type="button" data-login>Ingresar</button>`:''}<a class="btn btn-red" href="${back}&comprar=1">Comprar curso</a></div><a class="ac-link" href="${back}">Ver temario y clases gratis</a>`}</div></section>`);const lg=$('[data-login]');lg&&(lg.onclick=()=>goLogin('leccion.html?c='+slug+'&l='+lid));return}
 const {lesson:l,course:c,enrolled,next,prev}=r;let allP=r.allProgress,cp=r.courseProgress;document.title=l.title+' Â· Academia FrÃ­o Austral';
 const sub=enrolled?await A.subscription.forMe():null;
 set(`<section class="wrap ac-sec" style="padding-top:4px"><p class="ac-crumb"><a href="academia.html">${enrolled?'Temario':'Academia'}</a> / ${esc(c.title)}</p>
 ${enrolled?'':`<div class="ac-banner"><span><b>Clase gratis de vista previa.</b> Compra el curso para ver todas las lecciones.</span><a class="btn btn-red btn-sm" href="academia.html?c=${encodeURIComponent(c.slug)}&comprar=1">Comprar curso</a></div>`}
 <div class="ac-banner win" id="acWin" ${cp.pct===100&&enrolled?'':'hidden'}><span><b>Â¡Completaste el curso!</b> Ya puedes descargar tu certificado.</span><a class="btn btn-red btn-sm" href="certificado.html?c=${encodeURIComponent(c.slug)}">Obtener certificado</a></div>
 <div class="ac-play" style="margin-top:14px"><div class="ac-pm">
  <div class="ac-vw" id="vw"><video id="v" playsinline controls preload="metadata" ${l.poster?`poster="${esc(l.poster)}"`:''} aria-label="Video de la lecciÃ³n: ${esc(l.title)}"><source src="${esc(l.video)}" type="video/mp4">Tu navegador no puede reproducir este video.</video></div>
  <div class="ac-tool" role="toolbar" aria-label="Controles del video">
   <button class="ac-tb" type="button" id="bB" aria-label="Retroceder 10 segundos">${IC.back}<span>10 s</span></button>
   <button class="ac-tb" type="button" id="bF" aria-label="Adelantar 10 segundos"><span>10 s</span>${IC.fwd}</button>
   <label class="ac-tb"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Velocidad</span><select id="sp" aria-label="Velocidad de reproducciÃ³n">${[.75,1,1.25,1.5,1.75,2].map(x=>`<option value="${x}">${String(x).replace('.',',')}x</option>`).join('')}</select></label>
   <button class="ac-tb" type="button" id="bFs" aria-label="Pantalla completa">${IC.fs}<span>Pantalla completa</span></button><span class="sp"></span>
   ${enrolled?`<button class="ac-tb" type="button" id="bDone" aria-pressed="false">${IC.check}<span>Marcar completada</span></button>`:''}</div>
  <h1 class="ac-lt">${esc(l.title)}</h1><p class="ac-hint" style="margin-top:4px">LecciÃ³n ${r.index+1} de ${r.total}</p>
  <nav class="ac-pn" aria-label="Lecciones">${prev&&!prev.locked?`<a class="btn btn-line" href="leccion.html?c=${encodeURIComponent(c.slug)}&l=${encodeURIComponent(prev.id)}" aria-label="LecciÃ³n anterior: ${esc(prev.title)}"><i>â†</i><span>Anterior</span></a>`:'<span></span>'}
   ${next?next.locked?`<a class="btn btn-line nx" href="academia.html?c=${encodeURIComponent(c.slug)}&comprar=1"><span>Comprar para seguir</span><i>â†’</i></a>`:`<a class="btn btn-red nx" id="aNext" href="leccion.html?c=${encodeURIComponent(c.slug)}&l=${encodeURIComponent(next.id)}" aria-label="Siguiente lecciÃ³n: ${esc(next.title)}"><span>Siguiente lecciÃ³n</span><i>â†’</i></a>`:'<span></span>'}</nav>
  <div class="ac-ptabs" role="tablist" aria-label="InformaciÃ³n de la lecciÃ³n">${[['d','DescripciÃ³n'],['m','Materiales'],['n','Mis notas'],['q','Preguntas']].map(([k,t],i)=>`<button role="tab" type="button" id="t${k}" aria-controls="p${k}" aria-selected="${i===0}" tabindex="${i?-1:0}">${t}</button>`).join('')}</div>
  <div class="ac-pp" role="tabpanel" id="pd" aria-labelledby="td"><p class="ac-p">${esc(l.description)}</p></div>
  <div class="ac-pp" role="tabpanel" id="pm" aria-labelledby="tm" hidden>${enrolled?(l.resources&&l.resources.length?l.resources.map(x=>`<a class="ac-res" href="${esc(x.url)}" download>${IC.file}<span>${esc(x.title)}</span></a>`).join(''):'<p class="ac-p">Esta lecciÃ³n no tiene materiales.</p>'):'<p class="ac-p">Los materiales PDF son para alumnos del curso.</p>'}</div>
  <div class="ac-pp" role="tabpanel" id="pn" aria-labelledby="tn" hidden>${enrolled?`<form id="fNote" class="ac-pp" style="padding:0"><label class="ac-f"><span>Nueva nota</span><textarea class="ac-in" name="t" maxlength="1000" placeholder="Escribe lo que quieras recordar de esta parte del video"></textarea></label><button class="btn btn-line" type="submit" id="bNote">Guardar nota en 0:00</button></form><ul class="ac-notes" id="notes"></ul>`:'<p class="ac-p">Compra el curso para tomar notas con la marca de tiempo del video.</p>'}</div>
  <div class="ac-pp" role="tabpanel" id="pq" aria-labelledby="tq" hidden>${sub&&sub.active?`<p class="ac-p">Tienes la suscripciÃ³n para preguntas activa. Escribe tu duda en Mis consultas.</p><a class="btn btn-red" style="width:max-content" href="consultas.html">Hacer una pregunta</a>`:`<p class="ac-p">Las preguntas al equipo de FrÃ­o Austral son una <b>suscripciÃ³n aparte</b>. No la necesitas para ver el curso: es opcional, para quien quiere resolver dudas de su taller.</p><a class="btn btn-line" style="width:max-content" href="planes.html">Ver planes de suscripciÃ³n</a>`}</div>
 </div>
 <aside class="ac-side"><details class="ac-tocw" id="tocw" open><summary>Temario <small id="tocp">${enrolled?`${cp.done}/${cp.total} completadas`:`${r.total} lecciones`}</small></summary><div id="tocb">${toc(c,{current:l.id,allProgress:allP,enrolled})}</div></details></aside></div></section>`);
 /* pestaÃ±as */
 const T=$$('[role=tab]');T.forEach((t,i)=>{t.onclick=()=>{T.forEach(x=>{const on=x===t;x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1;$('#'+x.getAttribute('aria-controls')).hidden=!on})};
  t.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const n=T[(i+(e.key==='ArrowRight'?1:T.length-1))%T.length];n.focus();n.click()}}});
 /* temario: abierto en escritorio, plegable en mÃ³vil (queda debajo del video) */
 if(matchMedia('(max-width:1023px)').matches)$('#tocw').open=false;
 const v=$('#v'),vw=$('#vw');const SPK='fa_ac_speed';
 const sp=$('#sp');sp.value=localStorage.getItem(SPK)||'1';if(!sp.value)sp.value='1';v.playbackRate=+sp.value;
 sp.onchange=()=>{v.playbackRate=+sp.value;localStorage.setItem(SPK,sp.value)};v.addEventListener('ratechange',()=>{if(String(v.playbackRate)!==sp.value&&[...sp.options].some(o=>o.value===String(v.playbackRate)))sp.value=String(v.playbackRate)});
 $('#bB').onclick=()=>{v.currentTime=Math.max(0,v.currentTime-10)};$('#bF').onclick=()=>{v.currentTime=Math.min(v.duration||0,v.currentTime+10)};
 $('#bFs').onclick=async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();return}if(vw.requestFullscreen)await vw.requestFullscreen();else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen();return}
  if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(()=>{})}catch(e){toast('Tu navegador no permite pantalla completa aquÃ­')}};
 v.addEventListener('loadedmetadata',()=>{if(v.videoWidth&&v.videoHeight){const k=v.videoWidth/v.videoHeight;vw.style.aspectRatio=k>=1?String(Math.min(k,2.4)):'16/9'}
  const p=r.progress;if(p&&p.pos>3&&p.pos<(v.duration||0)-2){v.currentTime=p.pos;toast('Seguimos donde quedaste: '+mmss(p.pos))}v.playbackRate=+sp.value});
 let done=!!(r.progress&&r.progress.done),lastSave=0;
 const doneBtn=$('#bDone');const paint=()=>{if(!doneBtn)return;doneBtn.classList.toggle('done',done);doneBtn.setAttribute('aria-pressed',String(done));$('span',doneBtn).textContent=done?'Completada':'Marcar completada'};paint();
 const refresh=res=>{if(!res)return;cp=res.course;allP[l.id]=res.lesson;$('#tocp').textContent=`${cp.done}/${cp.total} completadas`;$('#tocb').innerHTML=toc(c,{current:l.id,allProgress:allP,enrolled});$('#tocb .ac-mod[open]')||0;$('#acWin').hidden=cp.pct!==100};
 const saveP=async(extra={})=>{if(!enrolled)return;lastSave=Date.now();refresh(await A.progress.save(c.slug,l.id,{pos:v.currentTime,dur:v.duration||0,...extra}))};
 if(enrolled)saveP({pos:r.progress?r.progress.pos:0});
 /* autoplay al venir de la leccion anterior */
 (function(){const q=new URLSearchParams(location.search);const want=q.get('autoplay')==='1'||sessionStorage.getItem('fa_ac_autoplay')==='1';sessionStorage.removeItem('fa_ac_autoplay');if(!want)return;const tryPlay=()=>v.play().then(()=>{try{const u=new URL(location.href);u.searchParams.delete('autoplay');history.replaceState({},'',u.pathname+u.search+u.hash)}catch(e){}}).catch(()=>{const ov=document.createElement('div');ov.className='ac-ov';ov.innerHTML='<div><b>Siguiente leccion</b><p>Toca para reproducir</p><div class="ac-acts"><button class="btn btn-red" type="button" id="cPlay">Reproducir</button></div></div>';vw.append(ov);$('#cPlay').onclick=()=>{ov.remove();v.play().catch(()=>{})};$('#cPlay').focus()});if(v.readyState>=2)tryPlay();else v.addEventListener('loadeddata',tryPlay,{once:true})})();
 v.addEventListener('timeupdate',()=>{if(!enrolled)return;if(!done&&v.duration&&v.currentTime/v.duration>=.9){done=true;paint();saveP({done:true});toast('LecciÃ³n completada')}else if(Date.now()-lastSave>5000)saveP();
  const b=$('#bNote');b&&(b.textContent='Guardar nota en '+mmss(v.currentTime))});
 v.addEventListener('pause',()=>saveP());addEventListener('pagehide',()=>saveP());
 doneBtn&&(doneBtn.onclick=()=>{done=!done;paint();saveP({done});toast(done?'LecciÃ³n completada':'LecciÃ³n marcada como pendiente')});
 /* autoplay de la siguiente con cuenta regresiva */
 v.addEventListener('ended',()=>{if(enrolled&&!done){done=true;paint();saveP({done:true,pos:0})}else saveP({pos:0});const a=$('#aNext');if(!a){if(!next&&enrolled){const ov=document.createElement('div');ov.className='ac-ov';ov.innerHTML=`<div><b>¡Terminaste la última lección!</b><p>${cp.pct===100?'Completaste el curso.':'Te quedan lecciones pendientes en el temario.'}</p><div class="ac-acts">${cp.pct===100?`<a class="btn btn-red btn-sm" href="certificado.html?c=${encodeURIComponent(c.slug)}">Obtener certificado</a>`:''}<a class="btn btn-line btn-sm" href="academia.html">Volver al temario</a></div></div>`;vw.append(ov)}return}const goUrl=a.getAttribute('href')+(a.getAttribute('href').includes('?')?'&':'?')+'autoplay=1';let n=5;
  const ov=document.createElement('div');ov.className='ac-ov';ov.innerHTML=`<div><b>Siguiente: ${esc(next.title)}</b><p aria-live="polite">Siguiente lección en <span id="cd">${n}</span> s…</p><div class="ac-acts"><button class="btn btn-line btn-sm" type="button" id="cCancel">Cancelar</button><a class="btn btn-red btn-sm" href="${goUrl}">Reproducir ya</a></div></div>`;vw.append(ov);
  const t=setInterval(()=>{n--;const s=$('#cd');s&&(s.textContent=n);if(n<=0){clearInterval(t);sessionStorage.setItem('fa_ac_autoplay','1');location.href=goUrl}},1000);
  $('#cCancel').onclick=()=>{clearInterval(t);ov.remove();toast('Autoplay cancelado')};const goNow=ov.querySelector('a.btn-red');if(goNow)goNow.addEventListener('click',e=>{e.preventDefault();sessionStorage.setItem('fa_ac_autoplay','1');location.href=goUrl});$('#cCancel').focus()});
 /* notas */
 if(enrolled){const draw=async()=>{const N=await A.notes.list(l.id);$('#notes').innerHTML=N.length?N.map(n=>`<li><button class="tm" type="button" data-t="${n.t}" aria-label="Ir al minuto ${mmss(n.t)}">${mmss(n.t)}</button><p>${esc(n.text)}</p><button class="del" type="button" data-del="${esc(n.id)}" aria-label="Borrar nota">Borrar</button></li>`).join(''):'<li style="background:none;border:0;padding:0;color:var(--mut)">TodavÃ­a no tienes notas en esta lecciÃ³n.</li>';
   $$('[data-t]').forEach(b=>b.onclick=()=>{v.currentTime=+b.dataset.t;v.play().catch(()=>{});vw.scrollIntoView({behavior:'smooth',block:'center'})});
   $$('[data-del]').forEach(b=>b.onclick=async()=>{await A.notes.remove(b.dataset.del);draw();toast('Nota borrada')})};draw();
  $('#fNote').onsubmit=async e=>{e.preventDefault();try{await A.notes.add(l.id,v.currentTime,e.target.t.value);e.target.reset();draw();toast('Nota guardada')}catch(x){toast(x.message)}}}
}

/* ---------- certificado ---------- */
async function cert(){const slug=Q.get('c'),code=Q.get('code');
 if(slug){const u=await A.auth.current();if(!u)return goLogin('certificado.html?c='+slug);
  try{const x=await A.certificates.issue(slug);location.replace('certificado.html?code='+encodeURIComponent(x.code))}
  catch(e){set(`<section class="wrap ac-sec"><div class="ac-empty glass"><h1 class="ac-h2">TodavÃ­a no</h1><p class="ac-p">${esc(e.message)}</p><a class="btn btn-red" href="mi-academia.html">Ir a Mi academia</a></div></section>`)}return}
 if(code){const x=await A.certificates.verify(code);
  if(!x){set(`<section class="wrap ac-sec"><div class="ac-empty glass"><h1 class="ac-h2">CÃ³digo no vÃ¡lido</h1><p class="ac-p">No encontramos un certificado con el cÃ³digo <b>${esc(code)}</b>.</p><a class="btn btn-line" href="certificado.html">Verificar otro cÃ³digo</a></div></section>`);return}
  const f=new Date(x.issued).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});document.title='Certificado '+x.code+' Â· FrÃ­o Austral';
  set(`<section class="wrap ac-sec" style="padding-top:8px"><p class="ac-crumb"><a href="mi-academia.html">Mi academia</a> / Certificado</p>
  <p class="ac-ok" style="margin-top:10px">âœ“ Certificado verificado</p>
  <div class="ac-cert" id="certBox"><img src="assets/logo-frio-austral.png" alt="FrÃ­o Austral" width="84" height="84"><span class="k">Certificado de finalizaciÃ³n</span><span class="m">Se certifica que</span><span class="n">${esc(x.name)}</span><span class="red"></span><span class="m">completÃ³ el curso</span><span class="c">${esc(x.course)}</span><span class="m">Academia FrÃ­o Austral Â· ${esc(f)}</span><span class="m">CÃ³digo de verificaciÃ³n: <b>${esc(x.code)}</b></span></div>
  <div class="ac-acts" style="max-width:900px;margin:18px auto 0"><button class="btn btn-red" type="button" id="bPr">Imprimir o guardar PDF</button><a class="btn btn-line" href="mi-academia.html">Volver a Mi academia</a></div>
  <p class="ac-hint" style="max-width:900px;margin:12px auto 0">Para guardarlo como PDF, toca "Imprimir o guardar PDF" y elige "Guardar como PDF".</p></section>`);
  $('#bPr').onclick=()=>print();return}
 set(`<section class="wrap ac-sec"><form class="ac-auth glass" id="fV"><h1 class="ac-h2" style="text-align:center">Verificar certificado</h1><label class="ac-f"><span>CÃ³digo del certificado</span><input class="ac-in" name="code" placeholder="FA-XXX-XXX" required autocapitalize="characters"></label><button class="btn btn-red" type="submit">Verificar</button></form></section>`);
 $('#fV').onsubmit=e=>{e.preventDefault();location.href='certificado.html?code='+encodeURIComponent(e.target.code.value.trim())}}

const P={catalogo,ingresar,mis,leccion,cert};
(P[page]||(()=>{}))().catch(e=>{console.warn(e);set(`<section class="wrap ac-sec"><div class="ac-empty glass"><h1 class="ac-h2">Algo fallÃ³</h1><p class="ac-p">Recarga la pÃ¡gina e intenta de nuevo.</p></div></section>`)});
})();
