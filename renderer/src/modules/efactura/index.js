import { repos } from '../../repos/index.js';
import { escapeHtml, uid } from '../../core/utils.js';

function badge(status){
  if (status === 'VALIDATED') return '<span class="badge badge--good">VALIDATED</span>';
  if (status === 'REJECTED') return '<span class="badge badge--bad">REJECTED</span>';
  if (status === 'PROCESSING') return '<span class="badge badge--warn">PROCESSING</span>';
  if (status === 'SUBMITTED') return '<span class="badge">SUBMITTED</span>';
  return '<span class="badge">—</span>';
}

export default function register(api){
  api.routes.add({
    path:'/efactura',
    title:'e-Factura',
    mount: async (root) => {
      const settings = api.storage.getSettings();
      const efSet = (await repos.kv.get('efactura_settings')) || {
        cuiEmitent: settings.company?.cui || '',
        token: '',
        environment: 'demo',
        autoSync: false
      };
      const invoices = await repos.invoices.list();
      let selected = invoices[0]?.id || '';
      const statuses = await repos.efactura.list();

      const getStatus = (invoiceId) => statuses.find(s=>s.invoiceId===invoiceId) || null;

      const render = async ()=>{
        const invList = await repos.invoices.list();
        const stList = await repos.efactura.list();
        const inv = selected ? invList.find(x=>x.id===selected) : null;
        const st = inv ? stList.find(x=>x.invoiceId===inv.id) : null;

        root.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between; align-items:flex-start">
              <div>
                <h1 class="h1">e-Factura</h1>
                <p class="p">MVP UI complet pentru câmpuri + statusuri. Integrarea reală se atașează ulterior ca plugin.</p>
              </div>
              <div class="row">
                <button class="btn" id="sync">Sync (demo)</button>
                <button class="btn btn--primary" id="send">Trimite selectata (demo)</button>
              </div>
            </div>

            <div class="grid2" style="margin-top:12px">
              <div class="card card--tight">
                <div class="label">Facturi</div>
                <select class="select" id="invSel">
                  <option value="">—</option>
                  ${invList.map(i=>`<option value="${escapeHtml(i.id)}" ${i.id===selected?'selected':''}>${escapeHtml(i.series)}-${escapeHtml(i.number)} • ${escapeHtml(i.clientSnapshot?.name||'')}</option>`).join('')}
                </select>
                <div style="margin-top:10px; color:var(--muted); font-size:12px">
                  Status: ${st ? badge(st.status) : badge('—')}
                </div>
                ${st?.lastError ? `<div style="margin-top:10px" class="badge badge--bad">${escapeHtml(st.lastError)}</div>` : ''}
              </div>

              <div class="card card--tight">
                <div class="row" style="justify-content:space-between; align-items:center">
                  <div>
                    <div class="label">Setări integrare</div>
                    <div style="color:var(--muted); font-size:12px">Token-ul e salvat local în IndexedDB (demo).</div>
                  </div>
                  <button class="btn" id="saveSet">Save</button>
                </div>

                <div class="grid2" style="margin-top:10px">
                  <div class="field">
                    <div class="label">CUI emitent</div>
                    <input class="input" id="cui" value="${escapeHtml(efSet.cuiEmitent||'')}">
                  </div>
                  <div class="field">
                    <div class="label">Mediu</div>
                    <select class="select" id="env">
                      <option value="demo" ${efSet.environment==='demo'?'selected':''}>demo</option>
                      <option value="prod" ${efSet.environment==='prod'?'selected':''}>prod</option>
                    </select>
                  </div>
                  <div class="field" style="grid-column:1/-1">
                    <div class="label">Token (demo)</div>
                    <input class="input" id="token" value="${escapeHtml(efSet.token||'')}" placeholder="...">
                  </div>
                </div>
              </div>
            </div>

            <div class="grid2" style="margin-top:12px">
              <div class="card card--tight">
                <div class="label">Câmpuri e-Factura (per factură)</div>
                <div style="color:var(--muted); font-size:12px; margin-bottom:10px">
                  Completezi câmpurile cerute (BT-*). Se salvează pe factură.
                </div>
                <div class="grid2">
                  <div class="field"><div class="label">Identif. linie (BT-126)</div><input class="input" id="bt126" value="${escapeHtml(inv?.efFields?.bt126||'')}"></div>
                  <div class="field"><div class="label">Tip linie (BT-127)</div><input class="input" id="bt127" value="${escapeHtml(inv?.efFields?.bt127||'')}"></div>
                  <div class="field"><div class="label">Ref. comandă (BT-132)</div><input class="input" id="bt132" value="${escapeHtml(inv?.efFields?.bt132||'')}"></div>
                  <div class="field"><div class="label">Ref. contabilă cumpărător (BT-133)</div><input class="input" id="bt133" value="${escapeHtml(inv?.efFields?.bt133||'')}"></div>
                  <div class="field"><div class="label">Identif. cumpărător altă ref. (BT-156)</div><input class="input" id="bt156" value="${escapeHtml(inv?.efFields?.bt156||'')}"></div>
                  <div class="field"><div class="label">Identif. vânzător altă ref. (BT-157)</div><input class="input" id="bt157" value="${escapeHtml(inv?.efFields?.bt157||'')}"></div>
                  <div class="field"><div class="label">Cod NC (BT-158)</div><input class="input" id="bt158" value="${escapeHtml(inv?.efFields?.bt158||'')}"></div>
                  <div class="field"><div class="label">Țara origine (BT-159)</div><input class="input" id="bt159" value="${escapeHtml(inv?.efFields?.bt159||'')}"></div>
                </div>
                <div class="row" style="margin-top:10px">
                  <button class="btn" id="saveFields">Save câmpuri</button>
                </div>
              </div>

              <div class="card card--tight">
                <div class="label">Timeline</div>
                <div style="color:var(--muted); font-size:12px; margin-bottom:10px">Evenimente (demo).</div>
                <div id="timeline">
                  ${(st?.events||[]).map(ev=>`
                    <div class="badge" style="display:block; margin-bottom:8px">
                      <b>${escapeHtml(ev.type)}</b> • ${new Date(ev.at).toLocaleString('ro-RO')}
                      ${ev.message ? `<div style="margin-top:4px; color:var(--muted)">${escapeHtml(ev.message)}</div>` : ''}
                    </div>
                  `).join('') || '<div class="badge">—</div>'}
                </div>

                <div style="margin-top:12px">
                  <div class="label">Submission ID</div>
                  <div class="badge">${escapeHtml(st?.submissionId||'—')}</div>
                </div>
              </div>
            </div>
          </div>
        `;

        root.querySelector('#invSel').addEventListener('change', e=>{ selected=e.target.value; render(); });

        root.querySelector('#saveSet').addEventListener('click', async ()=>{
          efSet.cuiEmitent = root.querySelector('#cui').value.trim();
          efSet.environment = root.querySelector('#env').value;
          efSet.token = root.querySelector('#token').value.trim();
          await repos.kv.set('efactura_settings', efSet);
          api.toast('e-Factura', 'Setări salvate', efSet.environment);
        });

        root.querySelector('#saveFields').addEventListener('click', async ()=>{
          if (!selected) return;
          const inv = await repos.invoices.get(selected);
          if (!inv) return;
          inv.efFields = {
            bt126: root.querySelector('#bt126').value.trim(),
            bt127: root.querySelector('#bt127').value.trim(),
            bt132: root.querySelector('#bt132').value.trim(),
            bt133: root.querySelector('#bt133').value.trim(),
            bt156: root.querySelector('#bt156').value.trim(),
            bt157: root.querySelector('#bt157').value.trim(),
            bt158: root.querySelector('#bt158').value.trim(),
            bt159: root.querySelector('#bt159').value.trim(),
          };
          await repos.invoices.put({ ...inv, updatedAt: Date.now() });
          api.toast('e-Factura', 'Câmpuri salvate', `${inv.series}-${inv.number}`);
          render();
        });

        root.querySelector('#send').addEventListener('click', async ()=>{
          if (!selected) return;
          const inv = await repos.invoices.get(selected);
          if (!inv) return;

          // demo state machine
          const id = uid('sub');
          const now = Date.now();
          const roll = Math.random();
          const willReject = roll < 0.15;

          const record = {
            id: uid('efs'),
            invoiceId: inv.id,
            status: 'SUBMITTED',
            submissionId: id,
            lastError: '',
            events: [
              { type:'SUBMITTED', at: now, message:'Document încărcat (demo).' }
            ],
            updatedAt: now
          };
          await repos.efactura.put(record);

          setTimeout(async ()=>{
            const r = await repos.efactura.get(record.id);
            if (!r) return;
            r.status = 'PROCESSING';
            r.events.push({ type:'PROCESSING', at: Date.now(), message:'Procesare ANAF (demo)...' });
            await repos.efactura.put(r);
            render();

            setTimeout(async ()=>{
              const r2 = await repos.efactura.get(record.id);
              if (!r2) return;
              if (willReject){
                r2.status = 'REJECTED';
                r2.lastError = 'Validare e-Factura (demo): lipsă câmp obligatoriu.';
                r2.events.push({ type:'REJECTED', at: Date.now(), message:r2.lastError });
              } else {
                r2.status = 'VALIDATED';
                r2.events.push({ type:'VALIDATED', at: Date.now(), message:'Validat (demo).' });
              }
              await repos.efactura.put(r2);
              api.toast('e-Factura', 'Status actualizat', r2.status);
              render();
            }, 1200);
          }, 900);

          api.toast('e-Factura', 'Trimis (demo)', id);
          render();
        });

        root.querySelector('#sync').addEventListener('click', async ()=>{
          api.toast('e-Factura', 'Sync demo', 'Refresc statusuri din IndexedDB.');
          render();
        });
      };

      render();
    },
    unmount:(root)=>{ root.innerHTML=''; }
  });
}
