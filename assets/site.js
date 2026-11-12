(()=>{const b=document.body,nav=document.querySelector('.nav'),bu=document.querySelector('.burger');
bu&&bu.addEventListener('click',()=>{const o=b.classList.toggle('menu-open');bu.setAttribute('aria-expanded',o)});
document.querySelectorAll('.drawer a').forEach(a=>a.addEventListener('click',()=>b.classList.remove('menu-open')));
const onS=()=>nav&&nav.classList.toggle('scrolled',scrollY>30);onS();addEventListener('scroll',onS,{passive:true});
const els=document.querySelectorAll('.reveal');if(!('IntersectionObserver' in window)){els.forEach(e=>e.classList.add('in'));return}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:0,rootMargin:'0px 0px -10% 0px'});setTimeout(()=>els.forEach(e=>e.classList.add('in')),1500);
els.forEach((el,i)=>{el.style.transitionDelay=(i%3)*80+'ms';io.observe(el)});
function estado(){const n=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Santiago'}));const d=n.getDay(),h=n.getHours()+n.getMinutes()/60;const open=d>=1&&d<=5&&h>=9&&h<18;
const t=open?'Abierto ahora · por orden de llegada':(d>=1&&d<=5&&h<9)?'Cerrado · abre hoy a las 9:00':(d>=1&&d<=4)?'Cerrado · abre mañana a las 9:00':'Cerrado · abre el lunes a las 9:00';
document.querySelectorAll('[data-open]').forEach(e=>{e.classList.toggle('is-open',open);const s=e.querySelector('.st-t');if(s)s.textContent=t})}
estado();setInterval(estado,60000)})();
