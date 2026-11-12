/* Maqueta Frío Austral: backend simulado con localStorage */
(function(){
const K='fa_demo_v1', now=()=>new Date().toISOString();
const seed=()=>({subs:[
 {id:'s1',nombre:'Pedro Soto',email:'pedro@ejemplo.cl',plan:'basico',estado:'activa',usadas:2,msgs:[{de:'u',t:'¿Qué aceite lleva un compresor Denso 10S17?',f:now()},{de:'a',t:'PAG 46, revisa la etiqueta del compresor.',f:now()},{de:'u',t:'¿Cuánto gas lleva una Hilux 2018?',f:now()}]},
 {id:'s2',nombre:'Taller Los Lagos',email:'contacto@ejemplo.cl',plan:'premium',estado:'activa',usadas:7,msgs:[{de:'u',t:'¿Cómo detecto una fuga con nitrógeno?',f:now()},{de:'a',t:'Presuriza a 150 psi y deja 30 min, revisa con espuma.',f:now()}]},
 {id:'s3',nombre:'Camila Ruiz',email:'camila@ejemplo.cl',plan:'basico',estado:'vencida',usadas:3,msgs:[{de:'u',t:'¿Sirve el R134a en un auto con R1234yf?',f:now()},{de:'a',t:'No, no se deben mezclar ni reemplazar.',f:now()}]}],me:null});
const db=()=>{try{return JSON.parse(localStorage.getItem(K))||seed()}catch(e){return seed()}}, save=d=>localStorage.setItem(K,JSON.stringify(d));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LIM={basico:3,pro:Infinity,premium:Infinity}, PN={basico:'Consulta · $5.000',pro:'Ilimitado · $10.000',premium:'Taller Pro · $20.000'};
const $=s=>document.querySelector(s);
const bubbles=(m,who)=>m.map(x=>`<div class="fa-m ${x.de===who?'fa-u':'fa-a'}">${esc(x.t)}<small>${x.de==='u'?'Suscriptor':'Frío Austral'} · ${new Date(x.f).toLocaleString('es-CL')}</small></div>`).join('')||'<p class="fa-ej mono">Sin mensajes todavía.</p>';
const page=document.body.dataset.fa;

if(page==='planes'){
 let plan; const m=$('#faModal');
 document.querySelectorAll('.fa-sub').forEach(b=>b.onclick=()=>{plan=b.dataset.plan;$('#faPlanName').textContent=PN[plan];m.hidden=false});
 m.querySelector('[data-close]').onclick=()=>m.hidden=true;
 $('#faSubForm').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),d=db();
  let s=d.subs.find(x=>x.email===f.get('email'));
  if(!s){s={id:'s'+Date.now(),nombre:f.get('nombre'),email:f.get('email'),usadas:0,msgs:[]};d.subs.push(s)}
  s.plan=plan;s.estado='activa';s.usadas=0;d.me=s.id;save(d);location.href='consultas.html'};
}

if(page==='consultas'){
 const render=()=>{const d=db(),s=d.subs.find(x=>x.id===d.me);
  $('#faNoUser').hidden=!!s;$('#faApp').hidden=!s;if(!s)return;
  const lim=LIM[s.plan],act=s.estado==='activa',left=lim===Infinity?'Ilimitadas':Math.max(0,lim-s.usadas);
  $('#faUName').textContent=s.nombre;$('#faUPlan').textContent=PN[s.plan];
  const st=$('#faUState');st.textContent=act?'Activa':'Vencida / impaga';st.className='fa-pill '+(act?'fa-ok':'fa-bad');
  $('#faLeft').textContent='Preguntas restantes: '+left+(lim===Infinity?'':' de '+lim);
  $('#faChat').innerHTML=bubbles(s.msgs,'u');$('#faChat').scrollTop=1e6;
  let blk='';
  if(!act)blk='Tu suscripción no está activa. Renueva tu plan para seguir haciendo preguntas.<br><a class="btn btn-red btn-sm" href="planes.html">Renovar suscripción</a>';
  else if(left===0)blk='Usaste tus 3 preguntas del mes del plan Consulta. Pásate al plan Ilimitado para preguntar sin tope.<br><a class="btn btn-red btn-sm" href="planes.html">Ver planes</a>';
  $('#faBlock').innerHTML=blk;$('#faBlock').hidden=!blk;
  $('#faMsg').disabled=!!blk;$('#faForm button').disabled=!!blk;
  const prem=s.plan==='premium';$('#faTabCom').hidden=!prem;
  if(!prem)show('chat');
  $('#faCom').innerHTML=d.subs.filter(x=>x.id!==s.id).flatMap(x=>{const o=[];x.msgs.forEach((m,i)=>{if(m.de==='u'){const r=x.msgs.slice(i+1).find(y=>y.de==='a');if(r)o.push(`<div class="fa-q"><b>${esc(m.t)}</b><p>${esc(r.t)}</p></div>`)}});return o}).join('')||'<p>Aún no hay preguntas respondidas.</p>';
 };
 const show=t=>{document.querySelectorAll('.fa-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));document.querySelectorAll('.fa-pane').forEach(p=>p.hidden=p.dataset.pane!==t)};
 document.querySelectorAll('.fa-tabs button').forEach(b=>b.onclick=()=>show(b.dataset.tab));
 $('#faForm').onsubmit=e=>{e.preventDefault();const d=db(),s=d.subs.find(x=>x.id===d.me),t=$('#faMsg').value.trim();
  if(!t||s.estado!=='activa'||s.usadas>=LIM[s.plan])return render();
  s.msgs.push({de:'u',t,f:now()});s.usadas++;save(d);$('#faMsg').value='';render()};
 $('#faToggleState').onclick=()=>{const d=db(),s=d.subs.find(x=>x.id===d.me);s.estado=s.estado==='activa'?'vencida':'activa';save(d);render()};
 $('#faLogout').onclick=()=>{const d=db();d.me=null;save(d);render()};
 if(!db().me){const d=db();save(d)} render();
 window.addEventListener('storage',render);
}

if(page==='admin'){
 let sel=null;const SK='fa_admin_session';
 const render=()=>{const ok=sessionStorage.getItem(SK)==='1';$('#faLogin').hidden=ok;$('#faAdmin').hidden=!ok;if(!ok)return;
  const d=db();$('#faStats').textContent=`${d.subs.length} suscriptores · ${d.subs.filter(s=>s.estado==='activa').length} activos`;
  $('#faRows').innerHTML=d.subs.map(s=>`<tr data-id="${s.id}" class="${s.id===sel?'sel':''}"><td>${esc(s.nombre)}<br><small class="mono">${esc(s.email)}</small></td><td>${PN[s.plan]}</td><td><span class="fa-pill ${s.estado==='activa'?'fa-ok':'fa-bad'}">${s.estado==='activa'?'Activa':'Vencida'}</span></td><td>${s.usadas}${s.plan==='basico'?' / 3':''}</td></tr>`).join('');
  document.querySelectorAll('#faRows tr').forEach(r=>r.onclick=()=>{sel=r.dataset.id;render()});
  const s=d.subs.find(x=>x.id===sel);$('#faAForm').hidden=!s;
  if(!s){$('#faAChat').innerHTML='';return}
  $('#faSel').innerHTML=`<div class="fa-row" style="justify-content:space-between"><b>${esc(s.nombre)} · ${PN[s.plan]}</b><button class="btn btn-sm ${s.estado==='activa'?'btn-line':'btn-red'}" id="faTog">${s.estado==='activa'?'Suspender suscripción':'Activar suscripción'}</button></div>`;
  $('#faTog').onclick=()=>{const d=db(),x=d.subs.find(y=>y.id===sel);x.estado=x.estado==='activa'?'vencida':'activa';save(d);render()};
  $('#faAChat').innerHTML=bubbles(s.msgs,'a');$('#faAChat').scrollTop=1e6;
 };
 $('#faLogin').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);if(f.get('u')==='admin'&&f.get('p')==='demo'){sessionStorage.setItem(SK,'1');$('#faErr').hidden=true;render()}else $('#faErr').hidden=false};
 $('#faOut').onclick=()=>{sessionStorage.removeItem(SK);render()};
 $('#faReset').onclick=()=>{if(confirm('¿Restablecer los datos de demostración?')){localStorage.removeItem(K);sel=null;render()}};
 $('#faAForm').onsubmit=e=>{e.preventDefault();const d=db(),s=d.subs.find(x=>x.id===sel),t=$('#faAMsg').value.trim();if(!t)return;s.msgs.push({de:'a',t,f:now()});save(d);$('#faAMsg').value='';render()};
 render();window.addEventListener('storage',render);
}
})();

/* ===== Admin: pestañas, catálogo y video del hero ===== */
(function(){
if(document.body.dataset.fa!=='admin'||!window.FA)return;
const $=s=>document.querySelector(s);
document.querySelectorAll('[data-atab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-atab]').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('[data-apane]').forEach(p=>p.hidden=p.dataset.apane!==b.dataset.atab)});

/* Catálogo */
const F=$('#faPForm');let editId=null,imgData='';
const shrink=file=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const s=Math.min(1,800/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=im.width*s;c.height=im.height*s;c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.82))};im.onerror=ko;im.src=r.result};r.onerror=ko;r.readAsDataURL(file)});
const formData=()=>{const f=new FormData(F);return{nombre:f.get('nombre').trim(),precio:f.get('precio')===''?null:Number(f.get('precio')),categoria:f.get('categoria').trim(),desc:f.get('desc').trim(),img:imgData||f.get('img').trim(),visible:!!f.get('visible')}};
const prev=()=>{$('#faPPrev').innerHTML=FA.card(formData())};
const rows=()=>{$('#faPRows').innerHTML=FA.getCat().map(p=>`<tr><td><img src="${FA.esc(p.img)}" alt=""></td><td>${FA.esc(p.nombre)}</td><td>${FA.clp(p.precio)||'—'}</td><td>${FA.esc(p.categoria)||'—'}</td><td>${p.visible?'Sí':'No'}</td><td><button class="btn btn-line btn-sm" data-ed="${p.id}">Editar</button><button class="btn btn-line btn-sm" data-del="${p.id}">Eliminar</button></td></tr>`).join('');
 document.querySelectorAll('[data-ed]').forEach(b=>b.onclick=()=>edit(b.dataset.ed));
 document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(!confirm('¿Eliminar este producto?'))return;FA.setCat(FA.getCat().filter(p=>p.id!==b.dataset.del));if(editId===b.dataset.del)clear();rows()})};
const clear=()=>{F.reset();editId=null;imgData='';$('#faPTitle').textContent='Nuevo producto';prev()};
const edit=id=>{const p=FA.getCat().find(x=>x.id===id);if(!p)return;editId=id;imgData=p.img&&p.img.startsWith('data:')?p.img:'';
 F.nombre.value=p.nombre;F.precio.value=p.precio??'';F.categoria.value=p.categoria;F.desc.value=p.desc;F.img.value=imgData?'':p.img;F.visible.checked=p.visible;F.file.value='';$('#faPTitle').textContent='Editar producto';prev();F.scrollIntoView({behavior:'smooth'})};
F.addEventListener('input',e=>{if(e.target.name==='img'&&e.target.value)imgData='';prev()});
F.file.onchange=async()=>{const f=F.file.files[0];if(!f)return;try{imgData=await shrink(f);F.img.value='';prev()}catch(e){alert('No se pudo leer la imagen.')}};
F.onsubmit=e=>{e.preventDefault();const d=formData(),c=FA.getCat();
 if(editId){const i=c.findIndex(p=>p.id===editId);c[i]={...c[i],...d}}else c.push({id:'p'+Date.now(),...d});
 try{FA.setCat(c)}catch(err){return alert('No hay espacio en el navegador para esta imagen. Usa una URL o una imagen más liviana.')}
 clear();rows()};
$('#faPCancel').onclick=clear;
$('#faPReset').onclick=()=>{if(confirm('¿Volver al catálogo inicial? Se borran los cambios.')){FA.resetCat();clear();rows()}};
clear();rows();

/* Video del hero */
let draft=null,draftBlob=null,draftUrl=null;
const frame=(s,mob)=>`<div class="fa-hm">${s?FA.media(s):'<img src="media/img/t2-gpic-960.webp" alt="">'}</div><div class="fa-ht"><p class="mono fa-ej" style="color:var(--ice)">Academia online · Video + PDF</p><h4>Domina el <span class="ice-text">aire acondicionado</span> automotriz.</h4><span class="btn btn-red">Ver cursos</span></div>`;
const paint=async()=>{const s=draft||await FA.resolveHero();$('#faHPD').innerHTML=frame(s);$('#faHPM').innerHTML=frame(s,1);
 const h=FA.getHero();$('#faHState').textContent=(draft?'Borrador sin publicar · ':'')+'Publicado: '+(h?(h.type==='file'?'video subido ('+(h.name||'archivo')+')':h.type==='yt'?'YouTube':'mp4 por URL'):'foto original')};
const err=t=>{$('#faHErr').textContent=t||'';$('#faHErr').hidden=!t};
$('#faHFile').onchange=()=>{const f=$('#faHFile').files[0];if(!f)return;err();if(draftUrl)URL.revokeObjectURL(draftUrl);draftBlob=f;draftUrl=URL.createObjectURL(f);draft={type:'file',url:draftUrl,name:f.name};paint()};
$('#faHLoad').onclick=()=>{const u=$('#faHUrl').value.trim();err();if(!u)return err('Pega una URL.');const id=FA.ytId(u);
 if(id)draft={type:'yt',id};else if(/^https?:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(u)||/^assets\//.test(u))draft={type:'mp4',url:u};else return err('La URL debe ser un .mp4/.webm o un link de YouTube.');draftBlob=null;paint()};
$('#faHPub').onclick=async()=>{if(!draft)return err('Primero sube un video o previsualiza una URL.');
 try{if(draft.type==='file'){await FA.idbPut('hero',draftBlob);localStorage.setItem(FA.HK,JSON.stringify({type:'file',ref:'hero',name:draft.name,at:Date.now()}))}
  else{await FA.idbDel('hero').catch(()=>{});localStorage.setItem(FA.HK,JSON.stringify({...draft,at:Date.now()}))}
  draft=null;draftBlob=null;$('#faHFile').value='';$('#faHUrl').value='';err();paint();alert('Publicado. La home ya usa este video.')}catch(e){err('No se pudo guardar el video en el navegador: '+e)}};
$('#faHDiscard').onclick=()=>{draft=null;draftBlob=null;$('#faHFile').value='';$('#faHUrl').value='';err();paint()};
$('#faHRestore').onclick=async()=>{if(!confirm('¿Volver a la foto original en la home?'))return;localStorage.removeItem(FA.HK);await FA.idbDel('hero').catch(()=>{});draft=null;paint()};
paint();
})();

/* ===== Admin: Links ===== */
(function(){
if(document.body.dataset.fa!=='admin'||!window.FA)return;
const $=s=>document.querySelector(s);
const draw=()=>{const L=FA.getLinks();$('#faLRows').innerHTML=Object.keys(L).map(k=>`<tr data-k="${k}"><td class="mono">${k}</td><td>${FA.esc(L[k].label)}</td><td><input class="fa-lurl" value="${FA.esc(L[k].href)}" style="width:100%;min-width:220px"></td><td><label class="fa-chk"><input type="checkbox" class="fa-lbl" ${L[k].blank?'checked':''}> Sí</label></td><td><button class="btn btn-line btn-sm fa-ltest" type="button">Probar</button></td></tr>`).join('');
 document.querySelectorAll('.fa-ltest').forEach(b=>b.onclick=()=>{const u=b.closest('tr').querySelector('.fa-lurl').value.trim();window.open(u,'_blank','noopener')})};
const err=t=>{$('#faLErr').textContent=t||'';$('#faLErr').hidden=!t};
$('#faLSave').onclick=()=>{const out={},bad=[];document.querySelectorAll('#faLRows tr').forEach(r=>{const k=r.dataset.k,u=r.querySelector('.fa-lurl').value.trim(),inp=r.querySelector('.fa-lurl');
  const changed=u!==FA.LINKS[k].href;inp.style.borderColor='';
  if(changed&&!FA.isHttps(u)){bad.push(k);inp.style.borderColor='#ff7b75';return}
  out[k]={blank:r.querySelector('.fa-lbl').checked};if(changed)out[k].href=u});
 if(bad.length)return err('Estas URLs deben empezar con https://: '+bad.join(', '));
 FA.setLinks(out);err();alert('Links guardados. Se aplican al recargar cada página.')};
$('#faLReset').onclick=()=>{if(confirm('¿Volver a los links originales?')){FA.resetLinks();err();draw()}};
draw();
})();
