/* Frío Austral v5 · medios (feat/media-frioaustral)
   MEDIA_BASE: cambiar a la URL de Vercel Blob (p.ej. 'https://xxxx.public.blob.vercel-storage.com/frio-austral/') al publicar. */
(()=>{const MEDIA_BASE=window.FA_MEDIA_BASE||'media/video/';
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
const c=navigator.connection||{};const small=matchMedia('(max-width: 879px)').matches||c.saveData===true;
const q=small?'720':'1080';
const src=n=>`<source src="${MEDIA_BASE}${n}-${q}.webm" type="video/webm"><source src="${MEDIA_BASE}${n}-${q}.mp4" type="video/mp4">`;
const fix=v=>{const t=v.querySelector('track');v.insertAdjacentHTML('afterbegin',src(v.dataset.media));if(t)t.src=MEDIA_BASE+v.dataset.media+'.es.vtt'};
const capsOn=v=>{for(const t of v.textTracks)if(t.kind==='captions')t.mode='showing'};
/* Hero V1: autoplay muteado + botón "Activar sonido" (reinicia en el frame 0).
   Con sonido activado: fuera de vista => silencio; al volver => sonido. reduced-motion => solo poster, sin botón */
function hero(){const v=document.querySelector('.hero video.hero-vid[data-media]');const btn=document.querySelector('.hero .fa-sound');
 if(!v||rm){if(btn)btn.hidden=true;return}
 const pi=document.querySelector('.fa-hero-poster img');v.poster=(pi&&pi.currentSrc)||'media/img/i1-hero-poster-960.webp';
 fix(v);v.preload='metadata';v.muted=true;v.autoplay=true;v.load();
 v.addEventListener('playing',()=>v.closest('.ph-img').classList.add('fa-playing'),{once:true});
 v.play().catch(()=>{});
 let on=false,inView=true;
 const set=()=>{if(!btn)return;btn.setAttribute('aria-pressed',on?'true':'false');const t=on?'Silenciar':'Activar sonido';btn.setAttribute('aria-label',t);btn.querySelector('span').textContent=t};
 if(btn){btn.hidden=false;btn.addEventListener('click',()=>{on=!on;if(on){v.currentTime=0;v.muted=false;v.play().catch(()=>{on=false;v.muted=true;set()})}else v.muted=true;set()})}
 if('IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(e=>{inView=e.isIntersecting;if(on)v.muted=!inView}),{threshold:.35}).observe(v)}
 /* subtítulos propios: el área visible del video queda detrás del texto del hero */
 const hb=v.closest('.hero'),cap=document.createElement('p');cap.className='fa-cap';cap.setAttribute('aria-hidden','true');hb.appendChild(cap);
 const place=()=>{if(matchMedia('(max-width: 879px)').matches){cap.style.top=Math.round(v.closest('.ph-img').offsetHeight*.56)+'px'}else{cap.style.top='';const w=hb.querySelector('.who');if(w){const hr=hb.getBoundingClientRect(),wr=w.getBoundingClientRect();cap.style.bottom=Math.round(hr.bottom-wr.top+14)+'px';cap.style.right=Math.round(hr.right-wr.right)+'px'}}};place();addEventListener('resize',place);
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
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run();
})();
