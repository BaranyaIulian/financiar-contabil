import { db } from '../../core/db.js';
import { uid, escapeHtml, money } from '../../core/utils.js';

// --- Page formats + templates (persisted in IndexedDB kv under `invoice_design`) ---
const PAGE_FORMATS = [
  { id: 'a4_portrait',  name: 'A4 Portrait',  aspect: '210 / 297', page: 'A4 portrait' },
  { id: 'a4_landscape', name: 'A4 Landscape', aspect: '297 / 210', page: 'A4 landscape' },
];

// Built-in invoice templates: CSS overlays applied on the preview sheet.
// IMPORTANT: keep selectors scoped to `.paper` or `#paperSheet` to avoid bleeding into the app UI.
// Templates include format-aware tweaks via: #paperSheet[data-format="a4_landscape"] ...
const BUILTIN_TEMPLATES = [
  {
    id: 'tpl_minimal',
    name: 'Minimal Clean',
    kind: 'builtin',
    css: `
      .paper{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#121317}
      .paperTitle{letter-spacing:-.05em}
      .paperHead{background:#f4f6f9; border:1px solid #e9edf4}
      .paperRow{border-bottom:1px solid #e9edf4}
      .paperTotals{border-top:1px solid #e9edf4}

      #paperSheet[data-format="a4_landscape"] .paperBlocks{display:grid; grid-template-columns: 1.1fr .9fr; gap:22px}
      #paperSheet[data-format="a4_landscape"] .paperTotals{width:420px}
    `.trim()
  },
  {
    id: 'tpl_alpha_gold',
    name: 'Alpha Gold (Black/Gold)',
    kind: 'builtin',
    css: `
      .paper{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#101216}
      .paper{position:relative}
      .paperTop{padding:0; margin:-14mm -14mm 12px; background:linear-gradient(90deg,#15181d 0 55%, #d9b15c 55% 100%); color:#fff}
      .paperTop > div{padding:20px 22px}
      .paperTitle{font-size:34px; letter-spacing:.08em; text-transform:uppercase}
      .paperMeta{color:rgba(255,255,255,.78)}
      .paperRight{color:#111; text-align:right}
      .paperRight .paperCompany{color:#111; font-size:16px}
      .paperRight .paperMeta{color:rgba(17,17,17,.74)}
      .paperBlocks{padding-top:10px}
      .paperHead{background:#fff; border:1px solid #e9dcc0}
      .paperRow{border-bottom:1px solid #efe3c7}
      .paperTotalRow--big{background:#fff4db; padding:10px 12px; border-radius:12px; border:1px solid #efe3c7}

      /* Logo badge style (uses company name placeholder) */
      .paperCompany{font-weight:900; letter-spacing:.06em; text-transform:uppercase}

      #paperSheet[data-format="a4_landscape"] .paperTop{background:linear-gradient(90deg,#15181d 0 50%, #d9b15c 50% 100%)}
      #paperSheet[data-format="a4_landscape"] .paperBlocks{display:grid; grid-template-columns:1fr 1fr; gap:26px}
      #paperSheet[data-format="a4_landscape"] .paperTotals{width:440px}
    `.trim()
  },
  {
    id: 'tpl_marine_blue',
    name: 'Marine Blue (Corporate)',
    kind: 'builtin',
    css: `
      .paper{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0c1220}
      .paperTop{margin:-14mm -14mm 14px; padding:22px 22px 18px; background:linear-gradient(135deg,#1c315a 0%, #132545 60%, #0f1d34 100%); color:#fff; position:relative; overflow:hidden}
      .paperTop:after{content:""; position:absolute; inset:-40px -80px auto auto; width:520px; height:220px; transform:rotate(14deg);
        background:repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0 8px, rgba(255,255,255,0) 8px 18px);
        border-radius:28px;
      }
      .paperTop > *{position:relative; z-index:1}
      .paperTitle{font-size:34px; letter-spacing:.02em; text-transform:uppercase}
      .paperMeta{color:rgba(255,255,255,.82)}
      .paperCompany{font-weight:900}

      .paperHead{background:#1c315a; color:#fff; border:0}
      .paperRow{border-bottom:1px solid #e7ebf5}
      .paperTotals{background:#f4f7ff; border:1px solid #e2e8fb; padding:10px 12px; border-radius:14px}
      .paperTotalRow--big{color:#1c315a}

      #paperSheet[data-format="a4_landscape"] .paperTop{padding:18px 22px}
      #paperSheet[data-format="a4_landscape"] .paperBlocks{display:grid; grid-template-columns:1fr 1fr; gap:26px}
      #paperSheet[data-format="a4_landscape"] .paperTotals{width:460px}
    `.trim()
  },
  {
    id: 'tpl_navy_orange',
    name: 'Navy/Orange (Diagonal)',
    kind: 'builtin',
    css: `
      .paper{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0d1220}
      .paperTop{margin:-14mm -14mm 14px; padding:22px; background:#0b1e3b; color:#fff; position:relative; overflow:hidden}
      .paperTop:before{content:""; position:absolute; left:-120px; top:-140px; width:520px; height:520px;
        background:linear-gradient(135deg,#f59a21 0%, #f59a21 48%, rgba(245,154,33,0) 48%);
        transform:rotate(14deg);
        opacity:.95;
      }
      .paperTop:after{content:""; position:absolute; left:120px; top:-160px; width:520px; height:520px;
        background:linear-gradient(135deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,0) 60%);
        transform:rotate(14deg);
      }
      .paperTop > *{position:relative; z-index:1}
      .paperTitle{font-size:34px; letter-spacing:.02em; text-transform:uppercase}
      .paperMeta{color:rgba(255,255,255,.80)}
      .paperCompany{font-weight:900}

      .paperHead{background:#0b1e3b; color:#fff; border:0}
      .paperRow{border-bottom:1px solid #e6e9f2}
      .paperTotalRow--big{background:#fff4e4; border:1px solid #ffe0b0; padding:10px 12px; border-radius:12px; color:#0b1e3b}
      .paperLabel{color:#6a7385}

      #paperSheet[data-format="a4_landscape"] .paperBlocks{display:grid; grid-template-columns:1fr 1fr; gap:26px}
      #paperSheet[data-format="a4_landscape"] .paperTotals{width:460px}
    `.trim()
  },
  {
    id: 'tpl_emerald_split',
    name: 'Emerald Split (Modern)',
    kind: 'builtin',
    css: `
      .paper{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0d1220}
      .paper{position:relative}
      /* (Removed) Left vertical ribbon — keeps page fully visible in preview/print */
      .paperTop{margin:-14mm -14mm 14px; padding:22px 22px 18px 22px; background:#ffffff; border-bottom:1px solid #e6efe9}
      .paperTitle{font-size:34px; letter-spacing:.02em; text-transform:uppercase}
      .paperCompany{font-weight:900; color:#0b7a56}
      .paperMeta{color:#5a6673}
      .paperHead{background:#0b7a56; color:#fff; border:0}
      .paperRow{border-bottom:1px solid #e6efe9}
      .paperTotals{background:#f0fbf7; border:1px solid #d6f2e7; padding:10px 12px; border-radius:14px}
      .paperTotalRow--big{color:#0b7a56}
      .paperLabel{color:#5a6673}
      #paperSheet[data-format="a4_landscape"] .paperBlocks{display:grid; grid-template-columns:1fr 1fr; gap:26px}
      #paperSheet[data-format="a4_landscape"] .paperTotals{width:460px}
    `.trim()
  },
];

function pickTemplate(list, id){
  return list.find(t => t.id === id) || list[0] || BUILTIN_TEMPLATES[0];
}

async function loadInvoiceDesignState(){
  const fallback = {
    pref: { formatId: PAGE_FORMATS[0].id, templateId: BUILTIN_TEMPLATES[0].id },
    custom: []
  };
  try{
    const saved = await db.kvGet('invoice_design');
    if (!saved || typeof saved !== 'object') return fallback;
    const pref = saved.pref && typeof saved.pref === 'object' ? saved.pref : fallback.pref;
    const custom = Array.isArray(saved.custom) ? saved.custom : [];
    const formatId = PAGE_FORMATS.some(f=>f.id===pref.formatId) ? pref.formatId : fallback.pref.formatId;
    const templateId = String(pref.templateId || fallback.pref.templateId);
    return { pref: { formatId, templateId }, custom };
  }catch(err){
    console.warn('[invoice] loadInvoiceDesignState failed', err);
    return fallback;
  }
}

async function saveInvoiceDesignState(pref, custom){
  const safePref = {
    formatId: PAGE_FORMATS.some(f=>f.id===pref?.formatId) ? pref.formatId : PAGE_FORMATS[0].id,
    templateId: String(pref?.templateId || BUILTIN_TEMPLATES[0].id)
  };
  const safeCustom = Array.isArray(custom) ? custom.slice(0, 50) : [];
  await db.kvSet('invoice_design', { pref: safePref, custom: safeCustom });
}

function calcTotals(items){
  const sub = items.reduce((a,it)=>a + (Number(it.qty||0)*Number(it.price||0)), 0);
  const vat = items.reduce((a,it)=>a + (Number(it.qty||0)*Number(it.price||0)) * (Number(it.vat||0)/100), 0);
  return { sub, vat, total: sub+vat };
}

function mountCPVPicker({ input, drop, statusEl, getList, onPick }){
  let open = false;
  let cursor = 0;
  let limit = 200;
  let lastQuery = '';

  const render = () => {
    const q = (input.value||'').trim().toLowerCase();
    if (!q) { drop.style.display = 'none'; open = false; return; }
    const list = getList() || [];
    const matches = [];
    for (let i=0;i<list.length;i++){
      const it = list[i];
      const hay = (it.code + ' ' + it.description).toLowerCase();
      if (hay.includes(q)) matches.push(it);
      if (matches.length >= 2000) break; // hard cap for perf
    }
    lastQuery = q;
    const view = matches.slice(0, limit);
    drop.innerHTML = view.map(it => `
      <div class="cpvItem" data-code="${escapeHtml(it.code)}" data-desc="${escapeHtml(it.description)}">
        <div class="cpvCode">${escapeHtml(it.code)}</div>
        <div class="cpvDesc">${escapeHtml(it.description)}</div>
      </div>
    `).join('') + (matches.length > limit ? `
      <div class="cpvItem" data-more="1">
        <div class="cpvCode">+</div>
        <div class="cpvDesc">Arată mai multe (+200)</div>
      </div>
    ` : '');
    drop.style.display = 'block';
    open = true;
    statusEl.textContent = `CPV loaded: ${list.length} • rezultate: ${matches.length}${matches.length>limit ? ` (afișate ${limit})` : ''}`;
  };

  input.addEventListener('input', ()=>{ limit=200; render(); });
  input.addEventListener('focus', render);
  document.addEventListener('click', (e)=>{
    if (!open) return;
    if (e.target.closest('.cpvDrop') || e.target === input) return;
    drop.style.display='none'; open=false;
  });

  drop.addEventListener('click', (e)=>{
    const more = e.target.closest('[data-more]');
    if (more) { limit += 200; render(); return; }
    const row = e.target.closest('[data-code]');
    if (!row) return;
    const code = row.dataset.code;
    const desc = row.dataset.desc;
    onPick({ code, description: desc });
    drop.style.display='none'; open=false;
  });
}

export default function register(api){
  api.routes.add({
    path:'/invoice',
    title:'Emitere',
    mount: async (root) => {
      const cleanup = [];
      const settings = api.storage.getSettings();
      const clients = await db.list('clients');

      // page format + template selection (persisted in IndexedDB kv)
      const designState = await loadInvoiceDesignState();
      let designPref = designState.pref;
      let customTemplates = designState.custom;
      let templatesAll = [...BUILTIN_TEMPLATES, ...customTemplates];
      let currentFormat = PAGE_FORMATS.find(x=>x.id===designPref.formatId) || PAGE_FORMATS[0];
      let currentTemplate = pickTemplate(templatesAll, designPref.templateId);

      let inv = {
        id: uid('inv'),
        series: settings.series?.prefix || 'UBM',
        number: settings.series?.nextNumber || 1,
        date: new Date().toISOString().slice(0,10),
        dueDays: 30,
        currency: 'RON',
        companySnapshot: settings.company || {},
        clientId: clients[0]?.id || '',
        clientSnapshot: clients[0] || { name:'', cui:'', address:'' },
        items: [],
        notes: '',
        efactura: { status: '—', submissionId: '', lastError: '' }
      };

      // --- Google-clean split UI (editor + live preview) ---
      root.innerHTML = `
        <div class="invSplit">
          <div class="invLeft">
            <div class="invTop">
              <div>
                <div class="invTitle">Invoice</div>
                <div class="invSub">Completează câmpurile — preview-ul se actualizează în timp real.</div>
              </div>
              <div class="row" style="gap:10px">
                <button class="btn" id="saveInv">Save</button>
                <button class="btn btn--primary" id="exportPdf">Export PDF</button>
                <button class="btn" id="printInv">Print</button>
              </div>
            </div>

            <div class="invCard">
              <div class="invSectionTitle">Detalii factură</div>
              <div class="invGrid">
                <div class="field">
                  <div class="label">Serie</div>
                  <input class="input" id="series" value="${escapeHtml(inv.series)}">
                </div>
                <div class="field">
                  <div class="label">Număr</div>
                  <input class="input" id="number" type="number" value="${escapeHtml(inv.number)}">
                </div>
                <div class="field">
                  <div class="label">Data emiterii</div>
                  <input class="input" id="date" type="date" value="${escapeHtml(inv.date)}">
                </div>
                <div class="field">
                  <div class="label">Termen plată (zile)</div>
                  <input class="input" id="dueDays" type="number" value="${escapeHtml(inv.dueDays)}">
                </div>
                <div class="field">
                  <div class="label">Client</div>
                  <select class="select" id="client">
                    <option value="">—</option>
                    ${clients.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===inv.clientId?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                </div>
                <div class="field">
                  <div class="label">Monedă</div>
                  <select class="select" id="currency">
                    ${['RON','EUR','USD'].map(x=>`<option ${x===inv.currency?'selected':''}>${x}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <div class="invCard">
              <div class="row" style="justify-content:space-between; align-items:center">
                <div class="invSectionTitle" style="margin:0">Items</div>
                <div class="chip" id="cpvChip">CPV: ${api.data.getCPV()?.length||0}</div>
              </div>

              <div class="invItemRow">
                <div class="field" style="grid-column:1 / span 4">
                  <div class="label">Description</div>
                  <input class="input" id="itDesc" placeholder="Item description...">
                </div>
                <div class="field">
                  <div class="label">Qty</div>
                  <input class="input" id="itQty" type="number" value="1">
                </div>
                <div class="field">
                  <div class="label">Price</div>
                  <input class="input" id="itPrice" type="number" value="0">
                </div>
                <div class="field">
                  <div class="label">TVA %</div>
                  <input class="input" id="itVat" type="number" value="19">
                </div>
                <button class="btn btn--primary" id="addItem">+ Add</button>
              </div>

              <div class="invItemRow" style="margin-top:10px; align-items:end; position:relative">
                <div class="field" style="grid-column:1 / span 6; position:relative">
                  <div class="label">CPV (code / description)</div>
                  <input class="input" id="itCpv" placeholder="ex: 80531200-7 sau 'informatica'">
                  <div class="cpvDrop" id="cpvDrop" style="display:none"></div>
                  <div class="help" id="cpvStatus">CPV loaded: ${api.data.getCPV()?.length||0}</div>
                </div>
                <div class="field" style="grid-column:7 / span 2">
                  <div class="label">NC (optional)</div>
                  <input class="input" id="itNc" placeholder="NC...">
                </div>
              </div>

              <div class="invTableWrap">
                <table class="table table--compact invItemsTable" id="itemsTable">
                  <thead>
                    <tr>
                      <th style="width:44%">Produs/serviciu</th>
                      <th style="width:10%; text-align:right">Qty</th>
                      <th style="width:14%; text-align:right">Preț</th>
                      <th style="width:10%; text-align:right">TVA</th>
                      <th style="width:14%; text-align:right">Valoare</th>
                      <th style="width:8%; text-align:right"></th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>

              <div class="field" style="margin-top:12px">
                <div class="label">Note</div>
                <textarea class="textarea" id="notes" rows="3" placeholder="...">${escapeHtml(inv.notes||'')}</textarea>
              </div>
            </div>
          </div>

          <div class="invRight">
            <div class="invPreviewHeader">
              <div class="invSectionTitle" style="margin:0">Preview</div>
              <div class="row" style="gap:8px; align-items:center">
                <select class="select" id="pageFormat" title="Page format">
                  ${PAGE_FORMATS.map(f=>`<option value="${escapeHtml(f.id)}" ${f.id===currentFormat.id?'selected':''}>${escapeHtml(f.name)}</option>`).join('')}
                </select>
                <button class="btn btn--ghost" id="btnTemplates">Templates</button>
                <span class="chip" id="statusChip">Live</span>
              </div>
            </div>
            <div class="invPaper" id="preview">
              <div class="paperViewport" id="paperViewport">
                <div class="paperScale" id="paperScale">
                  <div class="paperSheet" id="paperSheet"></div>
                </div>
              </div>
            </div>

            <div class="tplPanel" id="tplPanel">
              <div class="tplPanel__head">
                <div>
                  <div class="tplTitle">Invoice Templates</div>
                  <div class="tplSub">Alege un design sau importă un template (.ubtpl)</div>
                </div>
                <div class="row" style="gap:10px">
                  <label class="btn btn--ghost" style="cursor:pointer">
                    Import
                    <input id="tplImport" type="file" accept=".ubtpl,.json" style="display:none" />
                  </label>
                  <button class="btn" id="tplClose">Hide</button>
                </div>
              </div>
              <div class="tplGrid" id="tplGrid"></div>
              <div class="tplHint">Tip: importă un fișier cu structura { name, css, id(optional) }. CSS-ul se aplică pe foaia din preview.</div>
            </div>
          </div>
        </div>
      `;

      const $ = (sel)=>root.querySelector(sel);
      const itemsTbody = $('#itemsTable tbody');
      const paperSheet = $('#paperSheet');
      const paperViewport = $('#paperViewport');
      const paperScale = $('#paperScale');

      const getIsLandscape = () => currentFormat?.id === 'a4_landscape';

      // Keep preview proportions correct (A4 portrait/landscape) and always fit in the right panel.
      const PAPER_PX = { w: 794, h: 1123 }; // ~A4 at 96dpi
      const getPaperSize = () => getIsLandscape() ? { w: PAPER_PX.h, h: PAPER_PX.w } : { w: PAPER_PX.w, h: PAPER_PX.h };
      const applyPaperScale = () => {
        const { w, h } = getPaperSize();
        // set unscaled size
        paperScale.style.width = w + 'px';
        paperScale.style.height = h + 'px';
        paperSheet.setAttribute('data-format', currentFormat?.id || 'a4_portrait');
        paperSheet.classList.toggle('isLandscape', getIsLandscape());
        // compute scale to fit viewport
        const vw = paperViewport.clientWidth;
        const vh = paperViewport.clientHeight;
        if (!vw || !vh) return;
        const s = Math.min(vw / w, vh / h);
        // Allow upscale as well (when the panel is large) while keeping the A4 ratio.
        paperScale.style.zoom = (Math.max(0.05, Math.min(2.25, s))).toFixed(4);
      };

      const ro = new ResizeObserver(()=> applyPaperScale());
      ro.observe(paperViewport);
      cleanup.push(()=>{ try{ ro.disconnect(); }catch{} });

      const renderPaperHtml = (invData) => {
        const totals = calcTotals(invData.items);
        const company = invData.companySnapshot || {};
        const client = invData.clientSnapshot || {};
        return `
          <div class="paper ${getIsLandscape() ? "isLandscape" : ""}">
            <div class="paperTop">
              <div>
                <div class="paperTitle">Invoice</div>
                <div class="paperMeta">${escapeHtml(invData.series)}-${escapeHtml(invData.number)} • ${escapeHtml(invData.date)}</div>
                <div class="paperMeta">Due: ${escapeHtml(String(invData.dueDays||0))} days</div>
              </div>
              <div class="paperRight">
                <div class="paperCompany">${escapeHtml(company.name||'')}</div>
                <div class="paperMeta">CUI: ${escapeHtml(company.cui||'')}</div>
                <div class="paperMeta">${escapeHtml(company.address||'')}</div>
              </div>
            </div>
            <div class="paperBlocks">
              <div>
                <div class="paperLabel">Bill To</div>
                <div class="paperStrong">${escapeHtml(client.name||'')}</div>
                <div class="paperMeta">CUI: ${escapeHtml(client.cui||'')}</div>
                <div class="paperMeta">${escapeHtml(client.address||'')}</div>
              </div>
              <div style="text-align:right">
                <div class="paperLabel">Total Amount</div>
                <div class="paperTotal">${escapeHtml(money(totals.total))} ${escapeHtml(invData.currency)}</div>
                <div class="paperMeta">VAT: ${escapeHtml(money(totals.vat))}</div>
              </div>
            </div>
            <div class="paperTable">
              <div class="paperHead">
                <div>Item</div><div style="text-align:right">Qty</div><div style="text-align:right">Unit</div><div style="text-align:right">Tax</div><div style="text-align:right">Amount</div>
              </div>
              ${(invData.items.length?invData.items:[{desc:'—',qty:'',price:'',vat:'',cpvCode:'',cpvDesc:''}]).map(it=>{
                const amt = it.desc==='—' ? '—' : money((it.qty*it.price)*(1+it.vat/100));
                return `
                  <div class="paperRow">
                    <div>
                      <div class="paperStrong">${escapeHtml(it.desc||'')}</div>
                      ${it.cpvCode ? `<div class="paperMeta">CPV ${escapeHtml(it.cpvCode)} — ${escapeHtml(it.cpvDesc||'')}</div>` : ''}
                    </div>
                    <div style="text-align:right">${escapeHtml(String(it.qty||''))}</div>
                    <div style="text-align:right">${it.desc==='—'?'':escapeHtml(money(it.price||0))}</div>
                    <div style="text-align:right">${it.desc==='—'?'':escapeHtml(String(it.vat||0)+'%')}</div>
                    <div style="text-align:right" class="paperStrong">${escapeHtml(amt)}</div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="paperTotals">
              <div class="paperTotalRow"><div>Subtotal</div><div>${escapeHtml(money(totals.sub))}</div></div>
              <div class="paperTotalRow"><div>VAT</div><div>${escapeHtml(money(totals.vat))}</div></div>
              <div class="paperTotalRow paperTotalRow--big"><div>Total</div><div>${escapeHtml(money(totals.total))} ${escapeHtml(invData.currency)}</div></div>
            </div>
            ${invData.notes ? `<div class="paperNotes"><div class="paperLabel">Notes</div><div class="paperNotesText">${escapeHtml(invData.notes)}</div></div>` : ''}
          </div>
        `;
      };

      const buildPrintableHtml = (invData) => {
        const page = currentFormat?.page || 'A4 portrait';
        const tplCss = String(currentTemplate?.css || '').replaceAll('</style>', '');
        const baseCss = `
          @page{ size:${page}; margin:14mm; }
          html,body{margin:0; padding:0; background:#fff}
          body{font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#15161a}
          #paperSheet{display:block}
          .paper{padding:0}
          .paperTop{display:flex; justify-content:space-between; align-items:flex-start}
          .paperTitle{font-size:30px; font-weight:900; letter-spacing:-.03em}
          .paperMeta{color:#666; font-size:12px; margin-top:4px}
          .paperCompany{font-weight:900; font-size:14px}
          .paperLabel{color:#666; font-size:11px; letter-spacing:.02em; text-transform:uppercase}
          .paperStrong{font-weight:800}
          .paperBlocks{display:flex; justify-content:space-between; gap:18px; margin-top:18px}
          .paperTotal{font-size:28px; font-weight:900; margin-top:4px}
          .paperTable{margin-top:18px}
          .paperHead{display:grid; grid-template-columns: 1.6fr .4fr .6fr .4fr .6fr; gap:10px; padding:10px 12px; border-radius:10px; background:#f6f7f9; font-weight:800; font-size:12px}
          .paperRow{display:grid; grid-template-columns: 1.6fr .4fr .6fr .4fr .6fr; gap:10px; padding:10px 12px; border-bottom:1px solid #e7e8ee; font-size:12px}
          .paperTotals{margin-top:18px; width:320px; margin-left:auto; padding-top:10px}
          .paperTotalRow{display:flex; justify-content:space-between; padding:6px 0; font-size:12px}
          .paperTotalRow--big{font-size:14px; font-weight:900}
          .paperNotes{margin-top:18px}
          /* Show notes exactly as typed (keep line breaks & spacing) */
          .paperNotesText{white-space:pre-wrap; color:var(--muted); font-size:12px; line-height:1.35}
        `;
        return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice</title>
          <style>${baseCss}\n${tplCss}</style>
        </head><body>
          <div id="paperSheet" data-format="${escapeHtml(currentFormat.id)}">${renderPaperHtml(invData)}</div>
        </body></html>`;
      };

      function getActiveTemplates(){
        templatesAll = [...BUILTIN_TEMPLATES, ...customTemplates];
        currentTemplate = pickTemplate(templatesAll, designPref.templateId);
        return templatesAll;
      }

      function applyTemplateCss(){
        paperSheet.querySelectorAll('style[data-tpl]').forEach(s=>s.remove());
        const st = document.createElement('style');
        st.setAttribute('data-tpl','1');
        st.textContent = currentTemplate?.css || '';
        paperSheet.prepend(st);
      }

      const syncClientSnapshot = async () => {
        const currentClient = inv.clientId ? await db.get('clients', inv.clientId) : null;
        inv.clientSnapshot = currentClient || { name:'', cui:'', address:'' };
      };

      const renderItems = () => {
        const rows = inv.items.length ? inv.items : [];
        itemsTbody.innerHTML = rows.map((it,idx)=>{
          const lineTotal = (Number(it.qty||0) * Number(it.price||0)) * (1 + (Number(it.vat||0)/100));
          const meta = [
            it.cpvCode ? `CPV ${escapeHtml(it.cpvCode)}` : '',
            it.nc ? `NC ${escapeHtml(it.nc)}` : ''
          ].filter(Boolean).join(' • ');
          return `
            <tr class="invItemTr" data-idx="${idx}">
              <td>
                <input class="invCellInput invCellInput--strong" data-field="desc" value="${escapeHtml(it.desc||'')}" placeholder="Descriere...">
                <div class="invRowMeta">
                  <input class="invMetaInput" data-field="cpvCode" value="${escapeHtml(it.cpvCode||'')}" placeholder="CPV code">
                  <input class="invMetaInput" data-field="cpvDesc" value="${escapeHtml(it.cpvDesc||'')}" placeholder="CPV descriere">
                  <input class="invMetaInput invMetaInput--sm" data-field="nc" value="${escapeHtml(it.nc||'')}" placeholder="NC">
                </div>
              </td>
              <td style="text-align:right">
                <input class="invCellInput invCellInput--num" data-field="qty" type="number" step="1" min="0" value="${escapeHtml(String(it.qty ?? 0))}">
              </td>
              <td style="text-align:right">
                <input class="invCellInput invCellInput--num" data-field="price" type="number" step="0.01" min="0" value="${escapeHtml(String(it.price ?? 0))}">
              </td>
              <td style="text-align:right">
                <div class="invVatWrap">
                  <input class="invCellInput invCellInput--num" data-field="vat" type="number" step="0.01" min="0" max="100" value="${escapeHtml(String(it.vat ?? 0))}">
                  <span class="invPct">%</span>
                </div>
              </td>
              <td style="text-align:right">
                <div class="invLineTotal">${escapeHtml(money(lineTotal))}</div>
              </td>
              <td style="text-align:right">
                <button class="btn btn--ghost" data-del="${idx}" title="Delete">Del</button>
              </td>
            </tr>
          `;
        }).join('') || `
          <tr><td colspan="6"><div class="empty" style="padding:16px">Nu ai items încă. Adaugă primul item mai sus.</div></td></tr>
        `;
      };

      // Inline edit handlers (event delegation)
      let _previewTimer = null;
      const schedulePreview = () => {
        clearTimeout(_previewTimer);
        _previewTimer = setTimeout(()=>renderPreview(), 80);
      };

      itemsTbody.addEventListener('input', (e)=>{
        const inp = e.target.closest('[data-field]');
        if (!inp) return;
        const tr = inp.closest('tr[data-idx]');
        if (!tr) return;
        const idx = Number(tr.dataset.idx);
        const field = inp.dataset.field;
        const it = inv.items[idx];
        if (!it) return;
        let v = inp.value;
        if (['qty','price','vat'].includes(field)){
          const n = Number(v);
          it[field] = Number.isFinite(n) ? n : 0;
        } else {
          it[field] = v;
        }

        // update line total in-place
        const ltEl = tr.querySelector('.invLineTotal');
        if (ltEl){
          const lineTotal = (Number(it.qty||0) * Number(it.price||0)) * (1 + (Number(it.vat||0)/100));
          ltEl.textContent = money(lineTotal);
        }
        schedulePreview();
      });

      itemsTbody.addEventListener('click', (e)=>{
        const del = e.target.closest('[data-del]');
        if (!del) return;
        const idx = Number(del.dataset.del);
        inv.items.splice(idx, 1);
        renderItems();
        renderPreview();
      });

      const renderPreview = () => {
        paperSheet.dataset.format = currentFormat.id;
        paperSheet.classList.toggle('isLandscape', getIsLandscape());
        paperSheet.innerHTML = renderPaperHtml(inv);

        applyTemplateCss();
        applyPaperScale();
      };

      // --- Templates panel & preview thumbnails ---
      const tplPanel = $('#tplPanel');
      const tplGrid = $('#tplGrid');

      const renderTplGrid = () => {
        const all = getActiveTemplates();
        const sampleInv = {
          series: 'UBM', number: 12, date: inv.date,
          dueDays: 30, currency: inv.currency,
          companySnapshot: inv.companySnapshot,
          clientSnapshot: inv.clientSnapshot,
          items: [
            { desc:'Consulting Services', qty:1, price:1200, vat:19, cpvCode:'80531200-7', cpvDesc:'Business services' },
            { desc:'Subscription', qty:1, price:49, vat:19, cpvCode:'72268000-1', cpvDesc:'Software supply' },
          ]
        };
        const totals = calcTotals(sampleInv.items);
        const company = sampleInv.companySnapshot || {};
        const client = sampleInv.clientSnapshot || {};

        tplGrid.innerHTML = all.map(t=>{
          const active = (t.id===designPref.templateId);
          const thumbCss = String(t.css||'').replaceAll('#paperSheet', '.paperSheetThumb');
          return `
            <button class="tplCard ${active?'isActive':''}" data-tpl="${escapeHtml(t.id)}">
              <div class="tplThumbWrap">
                <div class="tplThumb" style="aspect-ratio:${escapeHtml(currentFormat.aspect)}">
                  <div class="tplThumbSheet">
                    <style data-thumb="1">${thumbCss}</style>
                    <div class="paperSheetThumb" data-format="${escapeHtml(currentFormat.id)}">
                    <div class="paper ${getIsLandscape() ? "isLandscape" : ""}">
                      <div class="paperTop">
                        <div>
                          <div class="paperTitle" style="font-size:14px">Invoice</div>
                          <div class="paperMeta" style="font-size:10px">${escapeHtml(sampleInv.series)}-${escapeHtml(sampleInv.number)} • ${escapeHtml(sampleInv.date)}</div>
                        </div>
                        <div class="paperRight">
                          <div class="paperCompany" style="font-size:11px">${escapeHtml(company.name||'Company')}</div>
                          <div class="paperMeta" style="font-size:10px">CUI: ${escapeHtml(company.cui||'')}</div>
                        </div>
                      </div>
                      <div class="paperBlocks" style="margin-top:10px">
                        <div>
                          <div class="paperLabel" style="font-size:10px">Bill To</div>
                          <div class="paperStrong" style="font-size:11px">${escapeHtml(client.name||'Client')}</div>
                        </div>
                        <div style="text-align:right">
                          <div class="paperLabel" style="font-size:10px">Total</div>
                          <div class="paperTotal" style="font-size:16px">${escapeHtml(money(totals.total))} ${escapeHtml(sampleInv.currency)}</div>
                        </div>
                      </div>
                      <div class="paperTotals" style="margin-top:10px">
                        <div class="paperTotalRow" style="font-size:10px"><div>Subtotal</div><div>${escapeHtml(money(totals.sub))}</div></div>
                        <div class="paperTotalRow" style="font-size:10px"><div>VAT</div><div>${escapeHtml(money(totals.vat))}</div></div>
                      </div>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="tplName">${escapeHtml(t.name||t.id)}</div>
              <div class="tplMeta">${escapeHtml(t.kind||'custom')}</div>
            </button>
          `;
        }).join('');

        tplGrid.querySelectorAll('[data-tpl]').forEach(btn=>btn.addEventListener('click', async ()=>{
          designPref = { ...designPref, templateId: btn.dataset.tpl };
          currentTemplate = pickTemplate(getActiveTemplates(), designPref.templateId);
          await saveInvoiceDesignState(designPref, customTemplates);
          renderTplGrid();
          renderPreview();
          api.toast('Template', 'Selectat', currentTemplate?.name || currentTemplate?.id);
        }));
      };

      const setTplVisible = (v) => {
        tplPanel.style.display = v ? 'block' : 'none';
        $('#btnTemplates').textContent = v ? 'Templates' : 'Templates';
        if (v) renderTplGrid();
      };

      // Templates visible by default (requested)
      setTplVisible(true);

      $('#btnTemplates').addEventListener('click', ()=>{
        const v = tplPanel.style.display === 'none';
        setTplVisible(v);
      });
      $('#tplClose').addEventListener('click', ()=> setTplVisible(false));

      $('#tplImport').addEventListener('change', async (e)=>{
        const f = e.target.files?.[0];
        if (!f) return;
        try{
          const txt = await f.text();
          const obj = JSON.parse(txt);
          const name = String(obj.name||obj.title||'Imported template').slice(0,80);
          const css = String(obj.css||'').trim();
          if (!css) throw new Error('Template invalid: missing "css"');
          const id = String(obj.id||uid('tpl_custom'));
          const safeId = BUILTIN_TEMPLATES.some(t=>t.id===id) ? uid('tpl_custom') : id;
          customTemplates = [{ id: safeId, name, kind:'custom', css }, ...customTemplates].slice(0, 50);
          designPref = { ...designPref, templateId: safeId };
          await saveInvoiceDesignState(designPref, customTemplates);
          currentTemplate = pickTemplate(getActiveTemplates(), designPref.templateId);
          renderTplGrid();
          renderPreview();
          api.toast('Template', 'Importat', name);
        }catch(err){
          console.error(err);
          api.toast('Template', 'Eroare import', String(err?.message||err));
        }finally{
          e.target.value='';
        }
      });

      $('#pageFormat').addEventListener('change', async (e)=>{
        const id = e.target.value;
        currentFormat = PAGE_FORMATS.find(x=>x.id===id) || PAGE_FORMATS[0];
        designPref = { ...designPref, formatId: currentFormat.id };
        await saveInvoiceDesignState(designPref, customTemplates);
        if (tplPanel.style.display==='block') renderTplGrid();
        renderPreview();
      });

      $('#series').addEventListener('input', e=>{ inv.series=e.target.value; renderPreview(); });
      $('#number').addEventListener('input', e=>{ inv.number=Number(e.target.value||0); renderPreview(); });
      $('#date').addEventListener('input', e=>{ inv.date=e.target.value; renderPreview(); });
      $('#dueDays').addEventListener('input', e=>{ inv.dueDays=Number(e.target.value||0); renderPreview(); });
      $('#currency').addEventListener('change', e=>{ inv.currency=e.target.value; renderPreview(); });
      $('#client').addEventListener('change', async e=>{ inv.clientId=e.target.value; await syncClientSnapshot(); renderPreview(); });
      $('#notes').addEventListener('input', e=>{ inv.notes=e.target.value; renderPreview(); });

      const itDesc = $('#itDesc');
      const itQty  = $('#itQty');
      const itPrice= $('#itPrice');
      const itVat  = $('#itVat');
      const itCpv  = $('#itCpv');
      const itNc   = $('#itNc');
      let pickedCPV = null;

      mountCPVPicker({
        input: itCpv,
        drop: $('#cpvDrop'),
        statusEl: $('#cpvStatus'),
        getList: ()=> api.data.getCPV(),
        onPick: (it)=>{ pickedCPV = it; itCpv.value = `${it.code} — ${it.description}`; }
      });

      // Allow picking CPV from the global titlebar search.
      const onGlobalCpv = (e)=>{
        const d = e?.detail;
        if (!d?.code) return;
        pickedCPV = { code: d.code, description: d.description || '' };
        itCpv.value = `${pickedCPV.code} — ${pickedCPV.description}`;
        itCpv.focus();
      };
      window.addEventListener('ubm:cpvPick', onGlobalCpv);
      cleanup.push(()=> window.removeEventListener('ubm:cpvPick', onGlobalCpv));

      $('#addItem').addEventListener('click', async ()=>{
        const desc = itDesc.value.trim(); if (!desc) return;
        const qty = Number(itQty.value||0) || 0;
        const price = Number(itPrice.value||0) || 0;
        const vat = Number(itVat.value||0) || 0;
        inv.items.push({
          id: uid('it'),
          desc, qty, price, vat,
          cpvCode: pickedCPV?.code || '',
          cpvDesc: pickedCPV?.description || '',
          nc: itNc.value.trim()
        });
        itDesc.value=''; itPrice.value='0'; itVat.value=String(vat||19); itNc.value=''; itCpv.value=''; pickedCPV=null;
        renderItems();
        renderPreview();
      });

      $('#saveInv').addEventListener('click', async ()=>{
        await syncClientSnapshot();
        await db.put('invoices', { ...inv, updatedAt: Date.now() });
        api.toast('Factură', 'Salvat', `${inv.series}-${inv.number}`);
      });

      $('#exportPdf').addEventListener('click', async ()=>{
        await syncClientSnapshot();
        await db.put('invoices', { ...inv, updatedAt: Date.now() });
        const html = buildPrintableHtml(inv);
        const filename = `${String(inv.series||'INV')}-${String(inv.number||'1')}.pdf`;
        try{
          const res = await window.ubm?.pdf?.saveFromHtml(html, { landscape: getIsLandscape(), defaultPath: filename });
          if (res?.canceled) return;
          api.toast('PDF', 'Exportat', String(res?.filePath || filename));
        }catch(err){
          console.error(err);
          api.toast('PDF', 'Eroare export', String(err?.message||err));
        }
      });

      $('#printInv').addEventListener('click', async ()=>{
        await syncClientSnapshot();
        const html = buildPrintableHtml(inv);
        try{
          await window.ubm?.print?.fromHtml(html, { landscape: getIsLandscape() });
        }catch(err){
          console.error(err);
          api.toast('Print', 'Eroare', String(err?.message||err));
        }
      });

      await syncClientSnapshot();
      renderItems();
      renderPreview();

      root.__cleanup = cleanup;
    },
    unmount:(root)=>{
      try{ (root.__cleanup||[]).forEach(fn=>{ try{ fn(); }catch{} }); }catch{}
      root.__cleanup = null;
      root.innerHTML='';
    }
  });
}
