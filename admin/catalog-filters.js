/* Model-level filters: monthly sales are never summed across colours or months. */
function saleMonthMatches(key, year, months) {
  return /^\d{4}-\d{2}$/.test(key) && (!year || key.slice(0,4)===year) && (!months.length || months.includes(key.slice(5,7)));
}
function modelTopSale(variants, year='', months=[]) {
  let best=null;
  for (const variant of variants) for (const [month,value] of Object.entries(variant.vm||{})) {
    const quantity=Number(value);
    if (quantity>=20 && saleMonthMatches(month,year,months) && (!best || quantity>best.quantity || (quantity===best.quantity && month>best.month))) best={quantity,month,reference:variant.r};
  }
  return best;
}
function filterCatalogueModels(data, criteria={}) {
  const {q='',category='',supplier='',year='',months=[],published='',top=false}=criteria;
  const groups=new Map();
  for (const variant of data) { const key=variant.t??variant.id; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(variant); }
  return [...groups.values()].filter(variants=>{
    if(!variants.some(x=>(!q||(x.n+' '+x.r).toLowerCase().includes(q.toLowerCase()))&&(!category||x.c===category)&&(!supplier||(x.pr||[]).includes(supplier))&&(!published||String(+x.p)===published)))return false;
    if(top)return !!modelTopSale(variants,year,months);
    // Preserve the existing purchase-period filter when Top ventas is off.
    if(year||(months.length>0&&months.length<12))return variants.some(x=>Object.keys(x.bm||{}).some(key=>saleMonthMatches(key,year,months)));
    return true;
  });
}
function topSaleCaption(sale) {
  return sale?`${sale.reference}: ${sale.quantity} vendidos en ${sale.month.slice(5)}/${sale.month.slice(0,4)}`:'';
}
let topSalesEnabled=false;
function selectedCatalogueMonths() { const months=[...document.querySelectorAll('.month-options input:checked')].map(input=>input.value);return months.length===12?[]:months; }
function catalogueCriteria() {
  return {q:document.getElementById('q').value.trim(),category:document.getElementById('cat').value,supplier:document.getElementById('sup').value,year:document.getElementById('year').value,months:selectedCatalogueMonths(),published:document.getElementById('pub').value,top:topSalesEnabled};
}
(() => {
  const style=document.createElement('style');
  style.textContent=`
    #list>.model.top-sales,#list>.model.top-sales:nth-child(even){border-color:#e6b5b3;border-top:4px solid #c34f49;box-shadow:0 3px 12px #a3272110}
    #list>.model.top-sales .modelhead{background:#fff1ef;border-bottom-color:#f0cfcc}
    .modelhead .top-sales-badge{display:inline-block;padding:3px 7px;margin-right:7px;border-radius:5px;background:#b6403b;color:white;font-size:calc(10px * var(--admin-scale));font-weight:700;vertical-align:middle}
    .top-sales-reason{margin:6px 0 0;color:#9c3935;font-size:calc(11px * var(--admin-scale));font-weight:normal;line-height:1.5}
    #topSalesToggle{font:inherit;font-size:calc(13px * var(--admin-scale));padding:10px 16px;min-height:40px;border:1px solid #c45a54;border-radius:8px;background:white;color:#a13d38;cursor:pointer}
    #topSalesToggle[aria-pressed=true]{background:#b6403b;color:white;box-shadow:0 2px 6px #a3272120}
    #topSalesToggle:focus-visible,.months-filter summary:focus-visible{outline:3px solid #148e99;outline-offset:2px}
    .top-sales-help{flex-basis:100%;font-size:calc(11px * var(--admin-scale));color:#6d8088;margin:0;line-height:1.5}
    .months-filter{flex:1;min-width:140px;position:relative;font-size:calc(13px * var(--admin-scale))}
    .months-filter summary{list-style:none;cursor:pointer;border:1px solid #d9e3e6;border-radius:8px;background:#fff;padding:calc(10px * var(--admin-scale));white-space:nowrap}
    .months-filter summary::-webkit-details-marker{display:none}.months-filter summary:after{content:'▾';float:right;margin-left:10px}
    .month-panel{position:absolute;top:calc(100% + 6px);right:0;z-index:40;width:min(320px,85vw);padding:12px;background:#fff;border:1px solid #d9e3e6;border-radius:10px;box-shadow:0 7px 25px #19394026}
    .month-options{display:grid;grid-template-columns:1fr 1fr;gap:4px}.month-options label{display:flex;align-items:center;gap:8px;padding:7px;cursor:pointer;border-radius:5px}.month-options label:has(input:checked){background:#e8f4f4;color:#126d76}
    .month-options input{flex:0 0 auto;width:17px;height:17px;min-width:0;padding:0;margin:0;accent-color:#148e99}
    .month-actions{display:flex;gap:8px;justify-content:space-between;border-top:1px solid #e3ecee;margin-top:9px;padding-top:10px}.month-actions button{font:inherit;border:1px solid #cddfe2;background:#f2f8f8;color:#176c74;padding:7px 10px;border-radius:6px;cursor:pointer}
    .photo-open.photo-failed span{background:#fff1ef;color:#9c3935;white-space:normal}.photo-open.photo-failed{background:#f8fafb}
    @media(max-width:650px){.months-filter{min-width:130px;font-size:calc(11px * var(--admin-scale))}.months-filter summary{padding:8px}.month-panel{position:fixed;top:auto;right:12px;width:calc(100vw - 24px);max-height:65dvh;overflow:auto}.month-options{grid-template-columns:1fr 1fr}.catalog-toolbar{align-items:center}}
  `;
  document.head.append(style);
  const native=document.getElementById('month');
  native.hidden=true;native.style.setProperty('display','none','important');
  const details=document.createElement('details');details.className='months-filter';
  const names=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  details.innerHTML='<summary aria-label="Seleccionar varios meses">Todos los meses</summary><div class="month-panel"><div class="month-options" role="group" aria-label="Meses del periodo">'+names.map((name,i)=>`<label><input type="checkbox" value="${String(i+1).padStart(2,'0')}" aria-label="${name}">${name}</label>`).join('')+'</div><div class="month-actions"><button type="button" data-month-action="all">Todos los meses</button><button type="button" data-month-action="clear">Limpiar selección</button><button type="button" data-month-action="done">Aplicar</button></div></div>';
  native.before(details);
  details.querySelector('summary').title='Puedes elegir varios meses. Con Top ventas se filtran ventas; sin Top ventas se mantiene el filtro de compras.';
  function changed(){const months=selectedCatalogueMonths();details.querySelector('summary').textContent=!months.length||months.length===12?'Todos los meses':months.length<=2?months.map(m=>names[Number(m)-1]).join(', '):months.length+' meses seleccionados';if(typeof update==='function')update();}
  details.addEventListener('change',changed);
  details.addEventListener('click',e=>{const action=e.target.closest('[data-month-action]')?.dataset.monthAction;if(!action)return;if(action==='done'){details.open=false;return;}details.querySelectorAll('input').forEach(input=>input.checked=action==='all');changed();});
  document.addEventListener('click',e=>{if(!details.contains(e.target))details.open=false;});
  details.addEventListener('keydown',e=>{if(e.key==='Escape'){details.open=false;details.querySelector('summary').focus();}});
  const toolbar=document.querySelector('.catalog-toolbar');
  const button=document.createElement('button');button.id='topSalesToggle';button.type='button';button.textContent='Top ventas';button.setAttribute('aria-pressed','false');button.title='Algún color con al menos 20 vendidos en un solo mes del periodo seleccionado. Se muestra el modelo completo.';
  const help=document.createElement('p');help.className='top-sales-help';help.textContent='Top ventas: un color con 20 o más vendidos en un mes. Respeta el año y los meses seleccionados; sin periodo, revisa todo el histórico.';
  if(toolbar){toolbar.insertBefore(button,toolbar.querySelector('.view-size'));toolbar.append(help);}
  button.onclick=()=>{topSalesEnabled=!topSalesEnabled;button.setAttribute('aria-pressed',String(topSalesEnabled));if(typeof update==='function')update();};
})();
