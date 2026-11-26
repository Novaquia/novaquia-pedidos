/* Private photo loading: expiring URLs, session renewal and visible retry states. */
let photoRefreshToken='',photoSessionExpires=0,photoSessionRefresh=null;
const photoSigning=new Map();
let cataloguePhotoObserver=null;
function rememberPhotoSession(session) {
  accessToken=session.access_token;
  photoRefreshToken=session.refresh_token||photoRefreshToken;
  photoSessionExpires=Date.now()+Number(session.expires_in||3600)*1000;
}
async function renewPhotoSession(force=false) {
  if(!force&&Date.now()<photoSessionExpires-60000)return;
  if(!photoRefreshToken){if(force)throw Error('Vuelve a iniciar sesión para cargar las fotos.');return;}
  if(!photoSessionRefresh)photoSessionRefresh=(async()=>{
    const response=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:photoRefreshToken})});
    const session=await response.json();if(!response.ok||!session.access_token)throw Error('La sesión ha caducado. Vuelve a iniciar sesión.');rememberPhotoSession(session);
  })().finally(()=>photoSessionRefresh=null);
  return photoSessionRefresh;
}
async function privatePhotoFetch(path,options={}) {
  await renewPhotoSession();
  let response=await fetch(SUPABASE_URL+path,{...options,headers:{...authHeaders(),...(options.headers||{})}});
  if(response.status===401){await renewPhotoSession(true);response=await fetch(SUPABASE_URL+path,{...options,headers:{...authHeaders(),...(options.headers||{})}});}
  return response;
}
async function signPhoto(name,force=false) {
  name=String(name).split(/[\\/]/).pop();
  if(force)photoCache.delete(name);
  const cached=photoCache.get(name);
  if(cached&&cached.expiresAt>Date.now()+60000)return cached.url;
  if(photoSigning.has(name))return photoSigning.get(name);
  const pending=(async()=>{
    const response=await privatePhotoFetch('/storage/v1/object/sign/'+BUCKET+'/'+encodeURIComponent(name),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:3600})});
    if(!response.ok)throw Error('No se pudo acceder a la fotografía.');
    const photo=await response.json();const signed=photo.signedURL||photo.signedUrl;
    if(!signed)throw Error('Fotografía no disponible.');
    const url=signed.startsWith('http')?signed:SUPABASE_URL+'/storage/v1'+(signed.startsWith('/')?'':'/')+signed;
    photoCache.set(name,{url,expiresAt:Date.now()+3500*1000});return url;
  })().finally(()=>photoSigning.delete(name));
  photoSigning.set(name,pending);return pending;
}
async function loadCataloguePhoto(img,generation=photoGeneration) {
  img.loading='eager';
  const button=img.closest('button');const caption=button?.querySelector('span');
  if(caption)caption.textContent='Cargando foto…';
  button?.classList.remove('photo-failed');button?.removeAttribute('data-photo-retry');
  for(let attempt=0;attempt<2;attempt++) {
    try {
      const url=await signPhoto(img.dataset.privatePhoto,attempt>0);
      if(!img.isConnected||generation!==photoGeneration)return;
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Photo timeout')),20000);
        img.onload=()=>{clearTimeout(timer);resolve();};img.onerror=()=>{clearTimeout(timer);reject(Error('Photo error'));};img.src=url;
        if(img.complete&&img.naturalWidth>0){clearTimeout(timer);resolve();}
      });
      if(!img.isConnected||generation!==photoGeneration)return;
      img.style.visibility='visible';if(caption)caption.textContent='Ampliar';return;
    } catch(error) {
      if(!img.isConnected||generation!==photoGeneration)return;
      if(attempt===1){img.style.visibility='hidden';button?.classList.add('photo-failed');button?.setAttribute('data-photo-retry','true');if(caption)caption.textContent=error.message.includes('sesión')?'Vuelve a iniciar sesión':'Reintentar foto';}
    }
  }
}
function loadVisiblePhotos() {
  const generation=++photoGeneration;const images=[...document.querySelectorAll('img[data-private-photo]')];
  if(cataloguePhotoObserver)cataloguePhotoObserver.disconnect();
  const queue=[];let active=0;
  function pump(){
    while(active<4&&queue.length&&generation===photoGeneration){
      const image=queue.shift();active++;
      loadCataloguePhoto(image,generation).finally(()=>{active--;pump();});
    }
  }
  if(typeof IntersectionObserver==='undefined'){queue.push(...images);pump();return;}
  cataloguePhotoObserver=new IntersectionObserver(entries=>{
    if(generation!==photoGeneration)return;
    for(const entry of entries)if(entry.isIntersecting){cataloguePhotoObserver.unobserve(entry.target);queue.push(entry.target);}
    pump();
  },{root:document.getElementById('catalogScroll'),rootMargin:'300px 0px'});
  for(const image of images)cataloguePhotoObserver.observe(image);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-photo-retry]');if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();const image=button.querySelector('img[data-private-photo]');if(image)loadCataloguePhoto(image);
},true);
