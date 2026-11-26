/* Model-level filters: monthly sales are never summed across colours or months. */
function saleMonthMatches(key, year, months) {
  return /^\d{4}-\d{2}$/.test(key) && (!year || key.slice(0,4)===year) && (!months.length || months.includes(key.slice(5,7)));
}
function modelTopSale(variants, year='', months=[], minimum=20, strict=false) {
  let best=null;
  for (const variant of variants) for (const [month,value] of Object.entries(variant.vm||{})) {
    const quantity=Number(value);
    if ((strict?quantity>minimum:quantity>=minimum) && saleMonthMatches(month,year,months) && (!best || quantity>best.quantity || (quantity===best.quantity && month>best.month))) best={quantity,month,reference:variant.r};
  }
  return best;
}
function modelStuckStock(variants, asOf) {
  const date=asOf||variants.map(x=>x.synced||'').filter(Boolean).sort().pop();
  if(!date)return null;
  const current=String(date).length===7?String(date):new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit'}).format(new Date(date)),currentIndex=Number(current.slice(0,4))*12+Number(current.slice(5,7))-1;
  if(!/^\d{4}-\d{2}$/.test(current))return null;
  const sales=variants.flatMap(x=>[x.fv||'',...Object.entries(x.vm||{}).filter(([,q])=>Number(q)>0).map(([month])=>month)]).filter(x=>/^\d{4}-\d{2}$/.test(x)).sort();
  const receipts=variants.flatMap(x=>Object.keys(x.bm||{})).filter(x=>/^\d{4}-\d{2}$/.test(x)).sort();
  const first=sales[0]||receipts[0];if(!first)return null;
  const age=currentIndex-(Number(first.slice(0,4))*12+Number(first.slice(5,7))-1);
  const stock=variants.reduce((sum,x)=>sum+Math.max(0,Number(x.s)||0),0);
  if(age<6||stock<20)return null;
  let sold=0;
  for(const x of variants)for(const [month,q] of Object.entries(x.vm||{})){
    const index=Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
    if(index>=currentIndex-6&&index<currentIndex)sold+=Math.max(0,Number(q)||0);
  }
  const coverage=sold>0?stock/(sold/6):Infinity;
  return coverage>12?{stock,sold,coverage,age,asOf:current,first,ageSource:sales.length?'primera venta':'primera recepción (sin ventas)'}:null;
}
function stuckStockCaption(info) {
  if(!info)return '';
  return `${info.stock} en stock · ${info.sold} vendidos en los últimos 6 meses completos · ${Number.isFinite(info.coverage)?Math.ceil(info.coverage)+' meses de existencias':'sin ventas recientes'} · ${info.age} meses desde ${info.ageSource}`;
}
function modelSalesPresentation(variants,criteria={}) {
  const top=modelTopSale(variants,criteria.year||'',criteria.months||[]);
  const superSale=modelTopSale(variants,criteria.year||'',criteria.months||[],35,true);
  const stuck=modelStuckStock(variants);
  if(stuck&&(criteria.mode==='stuck'||!top))return {className:'stuck-stock',badgeClass:'stuck-stock-badge',label:'ATASCADAS',reason:stuckStockCaption(stuck),secondary:superSale?'Más de 35 en el periodo':top?'Top ventas en el periodo':''};
  if(superSale)return {className:'super-sales',badgeClass:'super-sales-badge',label:'MÁS DE 35 / MES',reason:topSaleCaption(superSale)+(stuck?' · '+stuckStockCaption(stuck):''),secondary:stuck?'Atascadas':''};
  if(top)return {className:'top-sales',badgeClass:'',label:'TOP VENTAS',reason:topSaleCaption(top)+(stuck?' · '+stuckStockCaption(stuck):''),secondary:stuck?'Atascadas':''};
  return {className:'',badgeClass:'',label:'',reason:'',secondary:''};
}
function filterCatalogueModels(data, criteria={}) {
  const {q='',category='',supplier='',year='',months=[],published='',top=false,mode=''}=criteria;
  const groups=new Map();
  for (const variant of data) { const key=variant.t??variant.id; if(!groups.has(key))groups.set(key,[]);groups.get(key).push(variant); }
  return [...groups.values()].filter(variants=>{
    if(!variants.some(x=>(!q||(x.n+' '+x.r).toLowerCase().includes(q.toLowerCase()))&&(!category||x.c===category)&&(!supplier||(x.pr||[]).includes(supplier))&&(!published||String(+x.p)===published)))return false;
    if(mode==='stuck')return !!modelStuckStock(variants);
    if(mode==='super')return !!modelTopSale(variants,year,months,35,true);
    if(top||mode==='top')return !!modelTopSale(variants,year,months);
    // Preserve the existing purchase-period filter when Top ventas is off.
    if(year||(months.length>0&&months.length<12))return variants.some(x=>Object.keys(x.bm||{}).some(key=>saleMonthMatches(key,year,months)));
    return true;
  });
}
function topSaleCaption(sale) {
  return sale?`${sale.reference}: ${sale.quantity} vendidos en ${sale.month.slice(5)}/${sale.month.slice(0,4)}`:'';
}
let topSalesEnabled=false;
let catalogueSalesMode='';
function selectedCatalogueMonths() { const months=[...document.querySelectorAll('.month-options input:checked')].map(input=>input.value);return months.length===12?[]:months; }
function catalogueCriteria() {
  return {q:document.getElementById('q').value.trim(),category:document.getElementById('cat').value,supplier:document.getElementById('sup').value,year:document.getElementById('year').value,months:selectedCatalogueMonths(),published:document.getElementById('pub').value,top:topSalesEnabled,mode:catalogueSalesMode};
}
(() => {
  const style=document.createElement('style');
  style.textContent=`
    #list>.model.super-sales,#list>.model.super-sales:nth-child(even){border-color:#cfb6de;border-top:4px solid #9960b3;box-shadow:0 3px 12px #86549a14}
    #list>.model.super-sales .modelhead{background:#f4edf8;border-bottom-color:#e4d4ec}
    .model.super-sales .modelhead .super-sales-badge{background:#9054aa;color:white}
    #list>.model.stuck-stock,#list>.model.stuck-stock:nth-child(even){border-color:#e4cd76;border-top:4px solid #d2a824;box-shadow:0 3px 12px #a88a1514}
    #list>.model.stuck-stock .modelhead{background:#fff9df;border-bottom-color:#e9dca3}
    .model.stuck-stock .modelhead .stuck-stock-badge,.modelhead .secondary-badge.stuck-stock-badge{background:#efce59;color:#51410d}
    .modelhead .secondary-badge{display:inline-block;padding:3px 7px;margin:0 7px 3px 0;border-radius:5px;font-size:calc(10px * var(--admin-scale));font-weight:700}
    .model.super-sales .top-sales-reason{color:#805096}.model.stuck-stock .top-sales-reason{color:#7c6516}
    .sales-filter-buttons{display:flex;gap:8px;flex-wrap:wrap}
    .sales-filter-buttons button{font:inherit;font-size:calc(13px * var(--admin-scale));padding:10px 16px;min-height:40px;border:1px solid;border-radius:8px;background:white;cursor:pointer}
    #superSalesToggle{color:#805096;border-color:#aa7fc0}#superSalesToggle[aria-pressed=true]{color:white;background:#9460ac}
    #stuckStockToggle{color:#7a6114;border-color:#d4b346}#stuckStockToggle[aria-pressed=true]{color:#51410d;background:#f2d773}
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
  const buttons=document.createElement('div');buttons.className='sales-filter-buttons';buttons.append(button);
  const superButton=document.createElement('button');superButton.id='superSalesToggle';superButton.type='button';superButton.textContent='Más de 35 / mes';superButton.setAttribute('aria-pressed','false');superButton.title='Algún color vendido más de 35 unidades en un solo mes del periodo elegido. Modelo completo.';buttons.append(superButton);
  const stuckButton=document.createElement('button');stuckButton.id='stuckStockToggle';stuckButton.type='button';stuckButton.textContent='Atascadas';stuckButton.setAttribute('aria-pressed','false');stuckButton.title='Modelo con al menos 6 meses desde primera venta (o recepción si nunca se vendió), al menos 20 unidades en stock y existencias para más de 12 meses al ritmo de los últimos 6 meses completos. Según última sincronización.';buttons.append(stuckButton);
  if(toolbar){toolbar.insertBefore(buttons,toolbar.querySelector('.view-size'));toolbar.append(help);}
  const defaultHelp='Top ventas: ≥20 de un color en un mes. Malva: más de 35. Ambos respetan el año y los meses seleccionados. Amarillo: existencias con salida lenta según última sincronización.';
  help.textContent=defaultHelp;
  function setMode(mode){catalogueSalesMode=catalogueSalesMode===mode?'':mode;topSalesEnabled=catalogueSalesMode==='top';button.setAttribute('aria-pressed',String(topSalesEnabled));superButton.setAttribute('aria-pressed',String(catalogueSalesMode==='super'));stuckButton.setAttribute('aria-pressed',String(catalogueSalesMode==='stuck'));help.textContent=catalogueSalesMode==='stuck'?'Atascadas: ≥6 meses de antigüedad, ≥20 unidades en stock y cobertura >12 meses con las ventas de los últimos 6 meses completos. Usa la última sincronización, independientemente del año o meses elegidos.':defaultHelp;if(typeof update==='function')update();}
  button.onclick=()=>setMode('top');superButton.onclick=()=>setMode('super');stuckButton.onclick=()=>setMode('stuck');
})();
