(()=>{const mob=matchMedia('(max-width: 879px)').matches;
const tv=document.querySelector('video[data-movil]');
if(tv&&mob&&!tv.hasAttribute('data-lazy')){const b=tv.dataset.movil;tv.poster=tv.dataset.movilPoster;tv.innerHTML=`<source src="${b}.webm" type="video/webm"><source src="${b}.mp4" type="video/mp4">`;tv.load();tv.play&&tv.play().catch(()=>{})}
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('video[data-reel]').forEach(v=>{const load=()=>{if(!v.src){v.src=v.dataset.reel}};const play=()=>{if(rm)return;load();v.play().catch(()=>{})};const stop=()=>v.pause();
const a=v.closest('a');a.addEventListener('mouseenter',play);a.addEventListener('mouseleave',stop);a.addEventListener('focus',play);a.addEventListener('blur',stop);
if(matchMedia('(hover: none)').matches)new IntersectionObserver(e=>e[0].isIntersecting&&e[0].intersectionRatio>.6?play():stop(),{threshold:[0,.6]}).observe(v)});
const bar=document.querySelector('.mbar');if(!bar)return;
const setH=()=>document.documentElement.style.setProperty('--mbar-h',bar.offsetHeight+16+'px');setH();addEventListener('resize',setH);
let last=scrollY,block=false;
const ends=[...document.querySelectorAll('.v5-cta,.footer')];
const io=new IntersectionObserver(()=>{block=ends.some(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0});upd()});ends.forEach(e=>io.observe(e));
function upd(){const y=scrollY,down=y>last+4,up=y<last-4;if(block||down)bar.classList.add('v5-hide');else if(up||y<80)bar.classList.remove('v5-hide');last=y}
addEventListener('scroll',upd,{passive:true});
})();
