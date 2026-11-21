/* Shared by the private web catalogue and the desktop Administration page. */
function isSparePart(product) {
  const name = String(product.n || product.model || product.nombre || '');
  const category = String(product.c || product.categoria || '');
  const reference = String(product.r || product.ref || product.referencia || '').trim();
  return /\b(?:repuestos?|recambios?)\b/i.test(name + ' ' + category) || /^(?:VD|VI|FR)/i.test(reference);
}

function catalogModelTitle(name) {
  return String(name || '').replace(/^\[[^\]]+\]\s*/, '').replace(/\s+\(C\d+\)$/, '');
}

function adminCatalogRecord(row) {
  const d=row.datos||{},h=d.historico||{},id=Number(row.odoo_id);
  const bm=h.compras_mensuales||d.compras_mensuales||{},vm=h.salidas_mensuales||d.salidas_mensuales||{};
  const complete=h.completo===true;
  const received=h.compras_recibidas??d.compras_recibidas;
  const delivered=h.ventas_entregadas??h.salidas_totales??d.ventas_entregadas;
  const providers=h.proveedores||d.proveedores||{};
  const photo=d.foto_estado==='sin_foto_odoo'?null:(d.foto_local||h.foto_local||'').split(/[\\/]/).pop()||null;
  return {id,t:d.template_id||id,r:d.ref||h.referencia||('Sin referencia · #'+id),n:d.model||h.modelo||('Producto #'+id),c:d.categoria||h.categoria||'',p:!!d.publicado,s:Number(d.stock??0),f:photo?('FOTOS/'+photo):null,b:received==null?(complete?0:null):Number(received),v:delivered==null?(complete?Object.values(vm).reduce((sum,q)=>sum+Number(q||0),0):null):Number(delivered),bm,vm,fv:h.primera_venta||d.primera_venta||'',pr:Array.isArray(providers)?providers:Object.keys(providers),synced:d.sincronizado_en||''};
}

function catalogPhotoHtml(v, privatePhoto) {
  if (!v.f) return '<div class="photo photo-empty" role="img" aria-label="Sin foto en Odoo"><span>Sin foto en Odoo</span></div>';
  const name=v.f.split(/[\\/]/).pop();
  const source=privatePhoto?'data-private-photo="'+esc(name)+'"':'src="CATALOGO_ODOO/'+esc(encodeURI(v.f))+'"';
  return '<button type="button" class="photo photo-open" data-zoom-id="'+v.id+'" aria-label="Ampliar fotografía de '+esc(v.r)+'"><img loading="lazy" '+source+' alt="'+esc(v.r)+'" onerror="this.style.visibility=\'hidden\'"><span>Ampliar</span></button>';
}

function showCatalogSync(rows) {
  const latest=rows.map(row=>row.datos?.sincronizado_en||row.synced||'').filter(Boolean).sort().pop();
  let label=document.getElementById('catalogSync');
  if (!latest) return;
  if (!label) { label=document.createElement('p');label.id='catalogSync';label.className='catalog-sync';document.querySelector('.info')?.after(label); }
  label.textContent='Actualizado desde Odoo: '+new Date(latest).toLocaleString('es-ES',{timeZone:'Europe/Madrid'});
}

(() => {
  const style = document.createElement('style');
  style.textContent = `
    :root{--admin-scale:1}
    body{font:calc(14px * var(--admin-scale))/1.45 Arial,sans-serif;background:#f2f6f7;color:#23353c}
    .top-panel{box-shadow:0 3px 18px #16393e0b}
    .top-panel header{gap:22px;padding:calc(17px * var(--admin-scale)) max(20px,calc((100vw - 2160px)/2))}
    header img{width:calc(120px * var(--admin-scale));max-height:calc(58px * var(--admin-scale))}
    header h1{font-size:calc(23px * var(--admin-scale));letter-spacing:-.5px;line-height:1.25}
    header small{display:block;margin-top:5px;font-size:calc(12px * var(--admin-scale));line-height:1.4}
    .top-panel .filters{gap:9px;padding:12px max(20px,calc((100vw - 2160px)/2));border-top:1px solid #edf1f2;background:#f8fafb}
    .filters input,.filters select{min-width:140px;padding:calc(10px * var(--admin-scale));font:calc(13px * var(--admin-scale)) Arial;border-radius:8px;border-color:#d9e3e6}
    main#catalogScroll{padding:20px max(20px,calc((100vw - 2160px)/2)) 30px}
    .info{font-size:calc(12px * var(--admin-scale));line-height:1.55;background:#fff;border-color:#e0e8ea;padding:12px 15px;border-radius:9px;color:#60747c;margin-bottom:16px}
    .catalog-toolbar{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
    .count{margin:0;font-size:calc(13px * var(--admin-scale));font-weight:600;color:#5b737b}
    .view-size{display:flex;gap:7px;align-items:center;padding:6px 8px;background:#fff;border:1px solid #dce6e9;border-radius:10px;font-size:calc(12px * var(--admin-scale))}
    .view-size label{padding:0 6px;font-weight:600}.view-size output{min-width:48px;text-align:center;font-variant-numeric:tabular-nums}
    .view-size button{padding:6px 10px;min-height:32px;border:1px solid #dce6e9;border-radius:6px;background:#f4f9f9;color:#176c74;font:inherit;cursor:pointer}
    .view-size button:disabled{opacity:.35;cursor:default}.view-size button:focus-visible{outline:3px solid #148e99;outline-offset:2px}
    #list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(530px * var(--admin-scale))),1fr));gap:20px;align-items:start}
    #list>.model{margin:0;border:1px solid #dce7e9;border-top:3px solid #269aa4;border-radius:12px;box-shadow:0 3px 12px #12343b05;overflow:hidden;background:#fff}
    #list>.model:nth-child(even){border-top-color:#66858b}
    .modelhead,.model:nth-child(even) .modelhead{padding:14px 16px;gap:10px;background:#f7fafb;align-items:start;border-bottom:1px solid #e7eef0}
    .modelhead strong{font-size:calc(15px * var(--admin-scale));line-height:1.4;font-weight:700;overflow-wrap:anywhere}
    .modelhead span{font-size:calc(11px * var(--admin-scale));white-space:nowrap;color:#698089;padding-top:3px}
    .variants{padding:12px;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(165px * var(--admin-scale))),1fr))}
    .variant{padding:10px;border-radius:9px;border-color:#e2eaed}
    .photo{height:calc(125px * var(--admin-scale))}.photo img{height:calc(120px * var(--admin-scale))}
    .ref{font-size:calc(12px * var(--admin-scale));margin:10px 0 9px;overflow-wrap:anywhere}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));font-size:calc(10px * var(--admin-scale));gap:4px;padding:8px 0;border-top:1px solid #edf2f3;border-bottom:1px solid #edf2f3}.metrics span{display:flex;flex-direction:column;gap:2px;color:#6c8189}.metrics b{font-size:calc(17px * var(--admin-scale));line-height:1.3}
    .charttitle{font-size:calc(11px * var(--admin-scale));margin-top:12px}.chart{height:calc(78px * var(--admin-scale));gap:4px;margin-top:5px}
    .cell{max-width:calc(27px * var(--admin-scale));min-width:12px}.bar{max-width:calc(18px * var(--admin-scale))}
    .val{font-size:calc(10px * var(--admin-scale));line-height:1.3}.mon{font-size:calc(9px * var(--admin-scale));line-height:1.4}
    .first,.none{font-size:calc(10px * var(--admin-scale));line-height:1.5}.first{margin-top:6px}
    .pager{font-size:calc(13px * var(--admin-scale));margin:26px 0}.pager button{font:inherit;padding:10px 16px;border-radius:8px}
    @media(max-width:650px){
      .top-panel header{padding:12px;gap:12px}header img{width:75px;max-height:48px}header h1{font-size:calc(17px * var(--admin-scale));letter-spacing:-.2px}header small{font-size:calc(10px * var(--admin-scale))}
      .top-panel .filters{gap:6px;padding:9px 12px}.filters input,.filters select{min-width:130px;padding:8px;font-size:calc(11px * var(--admin-scale))}
      main#catalogScroll{padding:12px}.info{padding:10px;font-size:calc(10px * var(--admin-scale))}.catalog-toolbar{gap:10px;margin-bottom:12px}.view-size{margin-left:auto}
      #list{gap:14px}.modelhead{padding:12px}.modelhead strong{font-size:calc(13px * var(--admin-scale))}.variants{padding:8px;gap:7px;grid-template-columns:repeat(auto-fit,minmax(min(100%,calc(140px * var(--admin-scale))),1fr))}
      .variant{padding:7px}.photo{height:calc(95px * var(--admin-scale))}.photo img{height:calc(90px * var(--admin-scale))}
    }
    .photo-open{position:relative;width:100%;padding:0;border:0;background:#fff;cursor:zoom-in;border-radius:5px}
    .photo-empty{background:#f5f8f9;border-radius:6px;color:#6e838b;font-size:calc(12px * var(--admin-scale));text-align:center;padding:12px}.catalog-sync{font-size:calc(11px * var(--admin-scale));color:#657e87;margin:-5px 0 14px}
    .photo-open:focus-visible{outline:3px solid #148e99;outline-offset:2px}
    .photo-open span{position:absolute;right:2px;bottom:0;background:#edf6f7;color:#176c74;padding:2px 5px;border-radius:4px;font-size:calc(10px * var(--admin-scale))}
    #photoZoom{width:min(1050px,96vw);max-width:96vw;max-height:94dvh;padding:0;border:1px solid #cbdcde;border-radius:12px;color:#23353c;background:#fff}
    #photoZoom::backdrop{background:rgba(11,25,30,.78)}
    .zoom-header,.zoom-tools{display:flex;align-items:center;gap:10px;padding:12px 16px}
    .zoom-header{border-bottom:1px solid #dce7e8;justify-content:space-between}
    .zoom-header h2{font-size:16px;margin:0}.zoom-header p{font-size:12px;margin:4px 0 0}
    #photoZoom button{border:1px solid #cbdcde;border-radius:7px;padding:9px 13px;background:#edf6f7;color:#176c74;font:inherit;cursor:pointer;min-height:40px}
    #photoZoom button:disabled{opacity:.4;cursor:default}#photoZoom button:focus-visible{outline:3px solid #148e99}
    .zoom-stage{height:min(64dvh,620px);overflow:auto;background:#fff;overscroll-behavior:contain}
    .zoom-stage img{display:block;margin:12px auto;max-width:none;object-fit:contain}.zoom-stage img[hidden]{display:none}
    .zoom-tools{justify-content:center;border-top:1px solid #dce7e8;flex-wrap:wrap;font-size:14px}
    .zoom-tools input{width:min(180px,28vw)}.zoom-tools output{min-width:45px;text-align:center}
    #zoomStatus{text-align:center;padding:8px;color:#66777a;font-size:13px}
    @media(max-width:650px){.zoom-header{padding:10px}.zoom-header h2{font-size:14px}.zoom-stage{height:58dvh}.zoom-tools{gap:6px;padding:8px}}
  `;
  document.head.append(style);
  const count = document.getElementById('count');
  if (count) {
    const toolbar = document.createElement('div');
    toolbar.className = 'catalog-toolbar';
    count.before(toolbar);
    toolbar.append(count);
    const sizeControl = document.createElement('div');
    sizeControl.className = 'view-size';
    sizeControl.setAttribute('role', 'group');
    sizeControl.setAttribute('aria-label', 'Tamaño de toda la vista');
    sizeControl.innerHTML = '<label>Tamaño de vista</label><button type="button" id="viewSmaller" aria-label="Reducir tamaño de toda la página">−</button><output id="viewPercent" aria-live="polite">100 %</output><button type="button" id="viewLarger" aria-label="Aumentar tamaño de toda la página">+</button><button type="button" id="viewReset">Restablecer</button>';
    toolbar.append(sizeControl);
    let viewSize = 100;
    try {
      const stored = Number(localStorage.getItem('novaquia.admin.viewSize'));
      if (stored >= 80 && stored <= 150 && stored % 10 === 0) viewSize = stored;
    } catch (_) {}
    function applySize(value) {
      viewSize = Math.max(80, Math.min(150, value));
      document.documentElement.style.setProperty('--admin-scale', viewSize / 100);
      sizeControl.querySelector('#viewPercent').textContent = viewSize + ' %';
      sizeControl.querySelector('#viewSmaller').disabled = viewSize <= 80;
      sizeControl.querySelector('#viewLarger').disabled = viewSize >= 150;
      try { localStorage.setItem('novaquia.admin.viewSize', String(viewSize)); } catch (_) {}
    }
    sizeControl.querySelector('#viewSmaller').onclick = () => applySize(viewSize - 10);
    sizeControl.querySelector('#viewLarger').onclick = () => applySize(viewSize + 10);
    sizeControl.querySelector('#viewReset').onclick = () => applySize(100);
    applySize(viewSize);
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'photoZoom';
  dialog.setAttribute('aria-labelledby', 'zoomTitle');
  dialog.innerHTML = `<div class="zoom-header"><div><h2 id="zoomTitle">Fotografía ampliada</h2><p id="zoomReference"></p></div><button type="button" id="zoomClose" aria-label="Cerrar fotografía">Cerrar ✕</button></div>
    <div id="zoomStatus" role="status"></div><div class="zoom-stage" tabindex="0" aria-label="Fotografía; desplázate para ver los detalles ampliados"><img id="zoomImage" alt="" hidden></div>
    <div class="zoom-tools"><button type="button" id="zoomOut" aria-label="Alejar imagen">−</button><input id="zoomRange" type="range" min="100" max="400" step="25" value="100" aria-label="Nivel de ampliación"><button type="button" id="zoomIn" aria-label="Acercar imagen">+</button><output id="zoomPercent" for="zoomRange">100 %</output><button type="button" id="zoomReset">Restablecer</button></div>`;
  document.body.append(dialog);
  const image = dialog.querySelector('#zoomImage');
  const stage = dialog.querySelector('.zoom-stage');
  const range = dialog.querySelector('#zoomRange');
  const message = dialog.querySelector('#zoomStatus');
  let generation = 0;
  function resize() {
    if (!image.naturalWidth || !dialog.open) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const base = Math.min(image.naturalWidth, stage.clientWidth - 24, (stage.clientHeight - 24) * ratio);
    image.style.width = Math.max(1, base * Number(range.value) / 100) + 'px';
    dialog.querySelector('#zoomPercent').textContent = range.value + ' %';
    dialog.querySelector('#zoomOut').disabled = Number(range.value) <= 100;
    dialog.querySelector('#zoomIn').disabled = Number(range.value) >= 400;
  }
  function setZoom(value) { range.value = Math.max(100, Math.min(400, value)); resize(); }
  image.onload = () => { message.textContent = ''; image.hidden = false; resize(); };
  image.onerror = () => { image.hidden = true; message.textContent = 'No se ha podido cargar esta fotografía.'; };
  dialog.querySelector('#zoomClose').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { generation++; image.hidden = true; image.removeAttribute('src'); });
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.querySelector('#zoomIn').onclick = () => setZoom(Number(range.value) + 25);
  dialog.querySelector('#zoomOut').onclick = () => setZoom(Number(range.value) - 25);
  dialog.querySelector('#zoomReset').onclick = () => { setZoom(100); stage.scrollTo(0, 0); };
  range.oninput = resize;
  window.addEventListener('resize', resize);
  document.addEventListener('click', async event => {
    const button = event.target.closest('button[data-zoom-id]');
    if (!button) return;
    const product = DATA.find(x => String(x.id) === button.dataset.zoomId);
    if (!product || isSparePart(product)) return;
    const current = ++generation;
    dialog.querySelector('#zoomTitle').textContent = product.n;
    dialog.querySelector('#zoomReference').textContent = product.r;
    message.textContent = 'Cargando fotografía…';
    image.hidden = true;
    image.alt = 'Fotografía de ' + product.r + ': ' + product.n;
    range.value = '100';
    dialog.querySelector('#zoomPercent').textContent = '100 %';
    dialog.showModal();
    dialog.querySelector('#zoomClose').focus();
    try {
      const thumbnail = button.querySelector('img');
      // Reuse the authenticated signed URL; never change bucket visibility.
      const url = thumbnail.currentSrc || thumbnail.getAttribute('src') ||
        (typeof signPhoto === 'function' ? await signPhoto(product.f.split(/[\\/]/).pop()) : '');
      if (!dialog.open || generation !== current) return;
      if (!url) throw new Error('No photo');
      image.src = url;
    } catch (_) {
      if (dialog.open && generation === current) message.textContent = 'Fotografía no disponible. Cierra el visor e inténtalo de nuevo.';
    }
  });
})();
