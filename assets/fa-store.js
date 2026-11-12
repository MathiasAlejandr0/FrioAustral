/* Maqueta Frío Austral: catálogo (localStorage) y video del hero (IndexedDB + referencia en localStorage) */
window.FA=(function(){
const CK='fa_catalog_v1',HK='fa_hero_v1';
const SEED=[['Bomba de vacío','media/img/tienda-bomba-vacio-300.webp'],['Manómetros','media/img/tienda-manometro-300.webp'],['Vacuómetro','media/img/tienda-vacuometro-300.webp'],['Soldadura','media/img/tienda-soldadura-300.webp'],['Limpiador rosado','media/img/tienda-limpiador-rosado-300.webp']]
 .map((p,i)=>({id:'p'+(i+1),nombre:p[0],precio:null,categoria:'',desc:'',img:p[1],visible:true}));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const getCat=()=>{try{const v=JSON.parse(localStorage.getItem(CK));if(Array.isArray(v))return v}catch(e){}return SEED.map(x=>({...x}))};
const setCat=v=>localStorage.setItem(CK,JSON.stringify(v));
const resetCat=()=>localStorage.removeItem(CK);
const clp=n=>n||n===0?'$'+Number(n).toLocaleString('es-CL'):'';
const card=p=>`<div class="prod glass"><img src="${esc(p.img||'assets/logo-frio-austral.png')}" alt="${esc(p.nombre)}" loading="lazy">${p.categoria?`<span class="fa-cat mono">${esc(p.categoria)}</span>`:''}<b>${esc(p.nombre||'Nombre del producto')}</b>${p.desc?`<p>${esc(p.desc)}</p>`:''}${p.precio!=null&&p.precio!==''?`<span class="fa-price-s">${clp(p.precio)}</span>`:'<span class="soon mono">Pronto</span>'}</div>`;
/* IndexedDB */
const idb=()=>new Promise((ok,ko)=>{const r=indexedDB.open('fa_media',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});
const idbPut=(k,v)=>idb().then(d=>new Promise((ok,ko)=>{const t=d.transaction('files','readwrite');t.objectStore('files').put(v,k);t.oncomplete=ok;t.onerror=()=>ko(t.error)}));
const idbGet=k=>idb().then(d=>new Promise((ok,ko)=>{const r=d.transaction('files').objectStore('files').get(k);r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)}));
const idbDel=k=>idb().then(d=>new Promise(ok=>{const t=d.transaction('files','readwrite');t.objectStore('files').delete(k);t.oncomplete=ok}));
const ytId=u=>{const m=String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);return m&&m[1]};
const getHero=()=>{try{return JSON.parse(localStorage.getItem(HK))}catch(e){return null}};
/* src: {type:'file',url:blobURL} | {type:'mp4',url} | {type:'yt',id} */
const media=s=>s.type==='yt'?`<iframe src="https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&mute=1&loop=1&playlist=${s.id}&controls=0&playsinline=1&modestbranding=1" allow="autoplay; encrypted-media" title="Video Frío Austral"></iframe>`:`<video src="${esc(s.url)}" autoplay muted loop playsinline></video>`;
async function resolveHero(){const h=getHero();if(!h)return null;
 if(h.type==='file'){const b=await idbGet(h.ref).catch(()=>null);return b?{type:'file',url:URL.createObjectURL(b)}:null}
 return h}
function defaultHero(){const v=document.querySelector('.hero .ph-img video.hero-vid');if(!v||v.dataset.media)return;
 const mob=matchMedia('(max-width:1023px)').matches,b=mob?'movil':'1080';
 v.poster='assets/video/guillermo-hero-poster'+(mob?'-movil':'')+'.jpg';
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){v.removeAttribute('autoplay');return}
 v.innerHTML=`<source src="assets/video/guillermo-hero-${b}.webm" type="video/webm"><source src="assets/video/guillermo-hero-${b}.mp4" type="video/mp4">`;
 v.load();v.play&&v.play().catch(()=>{})}
async function applyHero(){const box=document.querySelector('.hero .ph-img');if(!box)return;const s=await resolveHero();
 if(!s)return defaultHero();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches&&s.type!=='yt'){box.innerHTML=media(s).replace(' autoplay','');return}
 box.innerHTML=media(s)}
function renderShop(){const row=document.querySelector('.shop-row');if(!row)return;row.innerHTML=getCat().filter(p=>p.visible).map(card).join('')||'<p>No hay productos visibles.</p>'}
const LK='fa_links_v1';
const LINKS={'ver-cursos':{label:'Ver cursos / Ver todos los cursos',href:'cursos.html',blank:false},
 'comprar-curso':{label:'Comprar curso (menú y hero)',href:'academia.html?c=aire-acondicionado-automotriz',blank:false},
 'curso-basico-avanzado':{label:'Curso Básico a Avanzado: Comprar',href:'academia.html?c=aire-acondicionado-automotriz',blank:false},
 'temario':{label:'Ver temario',href:'cursos.html',blank:false},
 'curso-parte2':{label:'Curso Parte #2 (acordeón home)',href:'cursos.html#parte2',blank:false},
 'suscripcion':{label:'Suscripción (acordeón home)',href:'cursos.html#suscripcion',blank:false},
 'ebooks':{label:'Ebooks (acordeón home)',href:'cursos.html#ebooks',blank:false}};
const getLinks=()=>{let v={};try{v=JSON.parse(localStorage.getItem(LK))||{}}catch(e){}const o={};for(const k in LINKS)o[k]={...LINKS[k],...(v[k]||{})};return o};
const setLinks=v=>localStorage.setItem(LK,JSON.stringify(v));const resetLinks=()=>localStorage.removeItem(LK);
const isHttps=u=>{try{return new URL(u).protocol==='https:'}catch(e){return false}};
function applyLinks(){let saved={};try{saved=JSON.parse(localStorage.getItem(LK))||{}}catch(e){}
 document.querySelectorAll('a[data-link]').forEach(a=>{const c=saved[a.dataset.link];if(!c)return;
  if(c.href&&isHttps(c.href))a.href=c.href;
  if(c.blank===true){a.target='_blank';a.rel='noopener'}else if(c.blank===false){a.removeAttribute('target')}})}
return{LK,LINKS,getLinks,setLinks,resetLinks,isHttps,applyLinks,CK,HK,getCat,setCat,resetCat,card,esc,clp,idbPut,idbGet,idbDel,ytId,getHero,media,resolveHero,applyHero,renderShop};
})();
document.addEventListener('DOMContentLoaded',()=>{FA.applyLinks();FA.renderShop();FA.applyHero()});
document.addEventListener('DOMContentLoaded',()=>{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 document.querySelectorAll('video.fa-tvid').forEach(v=>{v.removeAttribute('autoplay');v.pause();v.currentTime=0})});

/* Acordeón de cursos (home): uno abierto a la vez */
document.addEventListener('DOMContentLoaded',()=>{const bs=[...document.querySelectorAll('.fa-acc-btn')];
 bs.forEach(b=>b.addEventListener('click',()=>{const open=b.getAttribute('aria-expanded')!=='true';
  bs.forEach(x=>{const on=x===b&&open;x.setAttribute('aria-expanded',on);x.closest('.oth').classList.toggle('fa-open',on);document.getElementById(x.getAttribute('aria-controls')).setAttribute('aria-hidden',!on)})}));
 bs.forEach(x=>document.getElementById(x.getAttribute('aria-controls')).setAttribute('aria-hidden','true'))});

/* Estado Abierto/Cerrado del taller (Lun-Vie 9-18, hora de Chile) */
document.addEventListener('DOMContentLoaded',()=>{const el=document.querySelector('[data-horario]');if(!el)return;
 const upd=()=>{let d,h,m;try{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Santiago',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date()).map(x=>[x.type,x.value]));d=p.weekday;h=+p.hour%24;m=+p.minute}catch(e){const n=new Date();d=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][n.getDay()];h=n.getHours();m=n.getMinutes()}
  const t=h*60+m,open=!['Sat','Sun'].includes(d)&&t>=540&&t<1080;el.textContent=open?'Abierto ahora':'Cerrado ahora';el.className='fa-open-st '+(open?'on':'off');el.hidden=false};
 upd();setInterval(upd,60000)});
/* Count-up de la cifra de seguidores del hero */
document.addEventListener('DOMContentLoaded',()=>{const b=[...document.querySelectorAll('.hero-stats b')].find(x=>/383,9/.test(x.textContent));if(!b)return;
 const fin=b.textContent;if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const go=()=>{const t0=performance.now(),D=1400;const f=t=>{const k=Math.min(1,(t-t0)/D),e=1-Math.pow(1-k,3);b.textContent=(383.9*e).toFixed(1).replace('.',',')+' mil';if(k<1)requestAnimationFrame(f);else b.textContent=fin};requestAnimationFrame(f)};
 if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>{if(es[0].isIntersecting){io.disconnect();go()}});io.observe(b)}else go()});
