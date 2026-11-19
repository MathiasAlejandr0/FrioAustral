/* Frío Austral v5 · medios (feat/media-frioaustral)
   MEDIA_BASE: cambiar a la URL de Vercel Blob (p.ej. 'https://xxxx.public.blob.vercel-storage.com/frio-austral/') al publicar. */
(()=>{const MEDIA_BASE=window.FA_MEDIA_BASE||'media/video/';
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const c=navigator.connection||{};const small=matchMedia('(max-width: 879px)').matches||c.saveData===true;
const q=small?'720':'1080';
const src=(n,qq)=>`<source src="${MEDIA_BASE}${n}-${qq}.mp4" type="video/mp4"><source src="${MEDIA_BASE}${n}-${qq}.webm" type="video/webm">`;
/* video cambiado desde el panel (assets/fa-medios.js): una sola fuente, sin subtítulos del original */
const ovr=n=>(window.FA_MEDIA_OVERRIDE&&window.FA_MEDIA_OVERRIDE[n])||'';
/* Etapas de carga: (video del panel) -> calidad según pantalla -> 720. Si una etapa falla del todo
   (404, códec que el navegador no decodifica), se pasa a la siguiente; así nunca queda un video muerto. */
const fix=v=>{const n=v.dataset.media,o=ovr(n),t=v.querySelector('track');
 const st=[];
 if(o){if(t)t.remove();st.push(`<source src="${o}" type="${/\.webm(\?|$)/i.test(o)?'video/webm':'video/mp4'}">`)}
 st.push(src(n,q));if(q!=='720')st.push(src(n,'720'));
 let i=0,last=0;
 const apply=()=>{v.querySelectorAll('source').forEach(x=>x.remove());v.insertAdjacentHTML('afterbegin',st[i]);const ss=v.querySelectorAll('source');const cur=i;ss[ss.length-1].addEventListener('error',()=>next(cur))};
 const next=from=>{if(from!==i||i+1>=st.length||Date.now()-last<300)return;last=Date.now();i++;apply();v.load();v.dispatchEvent(new Event('fa-fallback'))};
 v.addEventListener('error',()=>next(i));
 apply();
 if(!o&&t)t.src=MEDIA_BASE+n+'.es.vtt';
 return ()=>next(i)};
const capsOn=v=>{for(const t of v.textTracks)if(t.kind==='captions')t.mode='showing'};
/* Hero V1: autoplay muteado + botón "Activar sonido" (reinicia en el frame 0).
   Con sonido activado: fuera de vista => silencio; al volver => sonido.
   reduced-motion (p.ej. Windows con "Efectos de animación" apagado o "mejor rendimiento"): no hay autoplay,
   pero el video queda disponible con el botón "Reproducir video" visible. Nunca queda solo el poster sin salida. */
function hero(){const v=document.querySelector('.hero video.hero-vid[data-media]');const btn=document.querySelector('.hero .fa-sound');
 if(!v){if(btn)btn.hidden=true;return}
 const hb=v.closest('.hero');
 const pi=document.querySelector('.fa-hero-poster img');v.poster=(pi&&pi.currentSrc)||'media/img/i1-hero-poster-960.webp';
 /* controles agrupados en una zona libre (nunca sobre la cara): reproducir / sonido / subtítulos */
 const ctl=document.createElement('div');ctl.className='fa-ctl';
 const play=document.createElement('button');play.type='button';play.className='fa-sound fa-play';play.hidden=true;
 play.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><span>Reproducir video</span>';
 const cc=document.createElement('button');cc.type='button';cc.className='fa-sound fa-cc';cc.setAttribute('aria-pressed','true');cc.setAttribute('aria-label','Ocultar subtítulos');cc.innerHTML='<span>Subtítulos</span>';
 ctl.appendChild(play);if(btn)ctl.appendChild(btn);ctl.appendChild(cc);hb.appendChild(ctl);
 const nextSrc=fix(v);v.preload='metadata';v.muted=true;v.autoplay=!rm;v.load();
 /* autoplay: si el navegador lo bloquea (Brave Shields, ahorro de datos, etc.) queda el poster y un botón que sí funciona */
 let started=false,want=!rm,inView=true;
 const ok=()=>{hb.classList.remove('fa-blocked');play.hidden=true};
 v.addEventListener('playing',()=>{started=true;v.closest('.ph-img').classList.add('fa-playing')});
 const blocked=()=>{hb.classList.add('fa-blocked');play.hidden=false};
 const attempt=()=>{want=true;try{const p=v.play();if(p&&p.catch)p.catch(e=>{if(!e||e.name!=='AbortError')blocked()})}catch(e){blocked()}};
 if(rm)blocked();else attempt();
 /* vigilante: si el video no avanza (~3 s) aunque debería (autoplay pendiente sin promesa, decode atascado,
    red lenta, etc.) se muestra el botón y se prueba la siguiente fuente una vez. Si vuelve a avanzar, se oculta. */
 let lastT=v.currentTime,stuck=0,switched=false;
 setInterval(()=>{if(!want||document.hidden||!inView)return;
  if(v.currentTime!==lastT&&!v.paused){lastT=v.currentTime;stuck=0;if(started)ok();return}
  if(++stuck===3){blocked();if(!switched&&!started){switched=true;nextSrc()}}},1000);
 v.addEventListener('fa-fallback',()=>{if(!started)attempt()});
 play.addEventListener('click',()=>{v.muted=true;stuck=0;attempt()});
 if(!rm)['pointerdown','keydown','touchend'].forEach(ev=>addEventListener(ev,()=>{if(!started){v.muted=true;attempt()}},{once:true,passive:true}));
 let on=false;
 const set=()=>{if(!btn)return;btn.setAttribute('aria-pressed',on?'true':'false');const t=on?'Silenciar':'Activar sonido';btn.setAttribute('aria-label',t);btn.querySelector('span').textContent=t};
 if(btn){btn.hidden=false;btn.addEventListener('click',()=>{on=!on;if(on){v.currentTime=0;v.muted=false;v.play().catch(()=>{on=false;v.muted=true;set()})}else v.muted=true;set()})}
 if('IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(e=>{inView=e.isIntersecting;if(on)v.muted=!inView}),{threshold:.35}).observe(v)}
 /* subtítulos propios: sobre el torso, nunca sobre la cara; se pueden ocultar */
 const cap=document.createElement('p');cap.className='fa-cap';cap.setAttribute('aria-hidden','true');hb.appendChild(cap);
 cc.addEventListener('click',()=>{const off=!cap.classList.contains('off');cap.classList.toggle('off',off);cc.setAttribute('aria-pressed',off?'false':'true');cc.setAttribute('aria-label',off?'Mostrar subtítulos':'Ocultar subtítulos')});
 const place=()=>{if(matchMedia('(max-width: 879px)').matches){cap.style.top='';cap.style.bottom='';cap.style.right=''}else{cap.style.top='';const w=hb.querySelector('.who');if(w){const hr=hb.getBoundingClientRect(),wr=w.getBoundingClientRect();cap.style.bottom=Math.round(hr.bottom-wr.top+14)+'px';cap.style.right=Math.round(hr.right-wr.right)+'px'}}};place();addEventListener('resize',place);
 const tr=v.textTracks[0];if(tr){tr.mode='hidden';tr.addEventListener('cuechange',()=>{const c=tr.activeCues&&tr.activeCues[0];cap.textContent=c?c.text.replace(/\n/g,' '):'';cap.classList.toggle('on',!!c)})}}
/* V2 y otros: click-to-play, se cargan al acercarse al viewport */
function lazy(){const vs=document.querySelectorAll('video.fa-lazyvid[data-media]');if(!vs.length)return;
 const go=v=>{if(v.dataset.ok)return;v.dataset.ok=1;fix(v);v.preload='metadata';v.load()};
 if(!('IntersectionObserver' in window))return vs.forEach(go);
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){go(e.target);io.unobserve(e.target)}}),{rootMargin:'300px'});
 vs.forEach(v=>{if(!small&&v.poster)v.poster=v.poster.replace('-960.webp','-1080.webp');io.observe(v);v.addEventListener('play',()=>capsOn(v),{once:true})})}
/* el video del hero parte después de la carga para no competir con el LCP (poster P1) */
const later=f=>{const go=()=>('requestIdleCallback' in window)?requestIdleCallback(f,{timeout:2500}):setTimeout(f,600);document.readyState==='complete'?go():addEventListener('load',go,{once:true})};
/* video existente del bloque Taller (index): mismo contenido, ahora carga al acercarse */
function taller(){const tv=document.querySelector('video.fa-tvid[data-lazy]');if(!tv)return;
 const go=()=>{const mob=matchMedia('(max-width: 879px)').matches;tv.poster=tv.dataset.poster;
  if(mob&&tv.dataset.movil){tv.poster=tv.dataset.movilPoster;tv.innerHTML=`<source src="${tv.dataset.movil}.webm" type="video/webm"><source src="${tv.dataset.movil}.mp4" type="video/mp4">`}
  else tv.querySelectorAll('source[data-src]').forEach(s=>s.src=s.dataset.src);
  tv.preload='metadata';tv.load();if(!rm)tv.play().catch(()=>{})};
 if(!('IntersectionObserver' in window))return go();
 const io=new IntersectionObserver(e=>{if(e[0].isIntersecting){io.disconnect();go()}},{rootMargin:'400px'});io.observe(tv)}
const run=()=>{later(hero);lazy();taller()};
/* espera (máx. 2,5 s) a saber si hay videos nuevos del panel */
const boot=()=>Promise.resolve(window.FA_MEDIA_READY).then(run,run);
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
