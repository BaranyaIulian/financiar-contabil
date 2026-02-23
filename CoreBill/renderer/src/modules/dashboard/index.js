export default function register(api){
  const fmtMoney = (n)=> (Math.round((Number(n)||0)*100)/100).toLocaleString('ro-RO', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const dayKey = (d)=> {
    const dt = new Date(d);
    if (Number.isNaN(+dt)) return '';
    return dt.toISOString().slice(0,10);
  };

  const renderSpark = (arr)=> {
    const w=220, h=46, pad=4;
    if (!arr.length) return `<svg viewBox="0 0 ${w} ${h}" class="spark"></svg>`;
    const max=Math.max(...arr, 1);
    const min=Math.min(...arr, 0);
    const span = Math.max(1e-9, (max-min));
    const pts = arr.map((v,i)=>{
      const x = pad + i*( (w-2*pad) / Math.max(1, arr.length-1) );
      const y = pad + (h-2*pad) * (1 - ((v-min)/span));
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="spark"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };

  const renderBars = (labels, values)=> {
    const w=520, h=140, pad=16;
    const max=Math.max(...values, 1);
    const bw = (w-2*pad)/Math.max(1, values.length);
    const bars = values.map((v,i)=>{
      const bh = (h-2*pad) * (v/max);
      const x = pad + i*bw + 6;
      const y = h - pad - bh;
      return `<rect x="${x}" y="${y}" width="${Math.max(6, bw-12)}" height="${bh}" rx="6" />`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="bars">${bars}</svg>
      <div class="bars__labels">${labels.map(l=>`<span>${l.slice(5)}</span>`).join('')}</div>`;
  };

  api.routes.add({
    path:'/dashboard',
    title:'Dashboard',
    mount: async (root) => {
      // Use the core IndexedDB wrapper directly (host api does not expose api.db)
      const { db } = await import('../../core/db.js');
      root.innerHTML = `
        <div class="dash">
          <div class="dash__top">
            <div>
              <div class="h1">Dashboard</div>
              <div class="p">Statistici live din facturi și clienți (local-first, IndexedDB).</div>
            </div>
            <div class="row" style="gap:10px">
              <button class="btn" id="dashRefresh">Refresh</button>
            </div>
          </div>

          <div class="dashGrid">
            <div class="card kpi">
              <div class="kpi__label">Invoices</div>
              <div class="kpi__value" id="kpiInvoices">—</div>
              <div class="kpi__sub">Total emise</div>
            </div>

            <div class="card kpi">
              <div class="kpi__label">Revenue</div>
              <div class="kpi__value" id="kpiRevenue">—</div>
              <div class="kpi__sub">Total (cu TVA)</div>
            </div>

            <div class="card kpi">
              <div class="kpi__label">Customers</div>
              <div class="kpi__value" id="kpiCustomers">—</div>
              <div class="kpi__sub">Clienți înregistrați</div>
            </div>

            <div class="card kpi">
              <div class="kpi__label">Trend (14 zile)</div>
              <div class="kpi__value kpi__value--small" id="kpiTrend">—</div>
              <div class="kpi__sub" id="kpiTrendSub">Facturi / zi</div>
              <div id="sparkWrap"></div>
            </div>
          </div>

          <div class="dashGrid2">
            <div class="card">
              <div class="card__head">
                <div class="h2">Invoices last 14 days</div>
                <div class="muted">Număr facturi pe zi</div>
              </div>
              <div id="barsInvoices"></div>
            </div>

            <div class="card">
              <div class="card__head">
                <div class="h2">Recent invoices</div>
                <div class="muted">Ultimele 8 facturi</div>
              </div>
              <div class="tableWrap">
                <table class="table">
                  <thead><tr><th>Nr</th><th>Client</th><th>Total</th><th>Data</th></tr></thead>
                  <tbody id="recentRows"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;

      const $ = (s)=>root.querySelector(s);

      const refresh = async ()=>{
        const [invoices, clients] = await Promise.all([
          db.list('invoices'),
          db.list('clients'),
        ]);

        const invCount = invoices.length;
        const custCount = clients.length;

        // totals
        let revenue = 0;
        const byDay = new Map(); // last 14 days
        const today = new Date();
        const days = Array.from({length:14}, (_,i)=>{
          const d = new Date(today);
          d.setDate(today.getDate()-(13-i));
          const k = d.toISOString().slice(0,10);
          byDay.set(k, 0);
          return k;
        });

        const recent = invoices
          .slice()
          .sort((a,b)=> String(b.date||'').localeCompare(String(a.date||'')));

        for (const inv of invoices){
          const items = inv.items || [];
          const total = items.reduce((s,it)=>{
            const qty = Number(it.qty||it.quantity||1)||0;
            const price = Number(it.price||it.unitPrice||0)||0;
            const tax = Number(it.tax||it.vat||it.vatPct||0)||0;
            const line = qty*price;
            return s + line + (line*(tax/100));
          }, 0);
          revenue += total;

          const k = dayKey(inv.date);
          if (byDay.has(k)) byDay.set(k, (byDay.get(k)||0) + 1);
        }

        $('#kpiInvoices').textContent = invCount.toLocaleString('ro-RO');
        $('#kpiCustomers').textContent = custCount.toLocaleString('ro-RO');
        $('#kpiRevenue').textContent = fmtMoney(revenue) + ' RON';

        const vals = days.map(k=>byDay.get(k)||0);
        const avg = vals.reduce((a,b)=>a+b,0)/Math.max(1, vals.length);
        $('#kpiTrend').textContent = avg.toFixed(2);
        $('#sparkWrap').innerHTML = renderSpark(vals);

        $('#barsInvoices').innerHTML = renderBars(days, vals);

        const rows = recent.slice(0,8).map(inv=>{
          const id = `${inv.series||''}-${inv.number||''}`.replace(/^-+|-+$/g,'') || inv.id || '—';
          const client = inv.clientSnapshot?.name || inv.clientName || '—';
          const items = inv.items || [];
          const total = items.reduce((s,it)=>{
            const qty = Number(it.qty||it.quantity||1)||0;
            const price = Number(it.price||it.unitPrice||0)||0;
            const tax = Number(it.tax||it.vat||it.vatPct||0)||0;
            const line = qty*price;
            return s + line + (line*(tax/100));
          }, 0);
          const date = inv.date || '—';
          return `<tr><td>${id}</td><td>${client}</td><td><b>${fmtMoney(total)} RON</b></td><td>${date}</td></tr>`;
        }).join('');
        $('#recentRows').innerHTML = rows || `<tr><td colspan="4" class="muted">Nu există facturi încă.</td></tr>`;
      };

      $('#dashRefresh').addEventListener('click', refresh);
      await refresh();
      return ()=>{};
    }
  });
}
