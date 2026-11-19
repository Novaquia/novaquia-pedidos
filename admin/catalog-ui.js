/* Shared by the private web catalogue and the desktop Administration page. */
function isSparePart(product) {
  const name = String(product.n || product.model || product.nombre || '');
  const category = String(product.c || product.categoria || '');
  const reference = String(product.r || product.ref || product.referencia || '').trim();
  return /\b(?:repuestos?|recambios?)\b/i.test(name + ' ' + category) || /^(?:VD|VI|FR)/i.test(reference);
}

(() => {
  const style = document.createElement('style');
  style.textContent = `
    .photo-open{position:relative;width:100%;padding:0;border:0;background:#fff;cursor:zoom-in;border-radius:5px}
    .photo-open:focus-visible{outline:3px solid #148e99;outline-offset:2px}
    .photo-open span{position:absolute;right:2px;bottom:0;background:#edf6f7;color:#176c74;padding:2px 5px;border-radius:4px;font-size:10px}
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
        (typeof signPhoto === 'function' ? await signPhoto(product.f) : '');
      if (!dialog.open || generation !== current) return;
      if (!url) throw new Error('No photo');
      image.src = url;
    } catch (_) {
      if (dialog.open && generation === current) message.textContent = 'Fotografía no disponible. Cierra el visor e inténtalo de nuevo.';
    }
  });
})();
