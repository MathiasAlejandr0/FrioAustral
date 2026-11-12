/* Botón Ingresar / Mi academia en el header de todas las páginas */
/* pestañas compactas [data-fatabs] (home y cursos) */
document.querySelectorAll('[data-fatabs]').forEach(w=>{const T=[...w.querySelectorAll('[role=tab]')];T.forEach((t,i)=>{t.addEventListener('click',()=>{T.forEach(x=>{const on=x===t;x.setAttribute('aria-selected',String(on));x.tabIndex=on?0:-1;document.getElementById(x.getAttribute('aria-controls')).hidden=!on})});
 t.addEventListener('keydown',e=>{if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;e.preventDefault();const n=T[(i+(e.key==='ArrowRight'?1:T.length-1))%T.length];n.focus();n.click()})})});
(function(){
const A=window.AcademiaData;if(!A)return;
const nav=document.querySelector('header.nav');if(!nav)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const a=document.createElement('a');a.className='btn btn-line btn-sm nav-login';a.href='ingresar.html';
a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/></svg><span>Ingresar</span>';
const bu=nav.querySelector('.burger'),cta=nav.querySelector('.nav-cta');nav.insertBefore(a,cta||bu||null);
A.auth.current().then(u=>{if(!u)return;a.href='academia.html';a.classList.add('in');
 a.innerHTML=`<span class="nav-av" aria-hidden="true">${esc(u.name.trim().charAt(0).toUpperCase()||'A')}</span><span>Mi academia</span>`;a.setAttribute('aria-label','Mi academia, sesión de '+u.name)});
})();
