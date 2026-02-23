import { escapeHtml, uid } from '../../core/utils.js';
import { db } from '../../core/db.js';

export default function register(api){
  api.routes.add({
    path:'/settings',
    title:'Setări',
    mount: async (root) => {
      const s = api.storage.getSettings();
      const auth = api.auth.get();
      const user = auth?.user;
      const isAdmin = user?.role === 'admin';

      const loadCompanies = async ()=>{
        if (!user || isAdmin) return [];
        const [companies, memberships] = await Promise.all([
          db.list('companies'),
          db.list('memberships')
        ]);
        const my = new Set(memberships.filter(m=>m.userId===user.id).map(m=>m.companyId));
        return companies.filter(c=>my.has(c.id));
      };

      let companies = await loadCompanies();

      const render = ()=>{
        root.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between; align-items:flex-start">
              <div>
                <h1 class="h1">Setări</h1>
                <p class="p">Core settings + sistem modular (plugin-uri) pregătit pentru extensii.</p>
              </div>
              <button class="btn btn--primary" id="save">Save</button>
            </div>

            ${(!isAdmin && user)?`
            <div class="card card--tight" style="margin-top:12px">
              <div class="row" style="justify-content:space-between; align-items:center">
                <div>
                  <div class="label">Firme (per cont)</div>
                  <div class="p" style="margin:6px 0 0">Alege firma activă sau creează una nouă. Datele firmei se folosesc în header-ul facturii.</div>
                </div>
              </div>
              <div class="grid2" style="margin-top:10px">
                <div class="field">
                  <div class="label">Firmă activă</div>
                  <select class="select" id="activeCompany">
                    <option value="">— selectează —</option>
                    ${companies.map(c=>`<option value="${escapeHtml(c.id)}" ${auth.activeCompanyId===c.id?'selected':''}>${escapeHtml(c.name||'Firma')}</option>`).join('')}
                  </select>
                </div>
                <div></div>
              </div>

              <div class="grid3" style="margin-top:12px">
                <div class="field"><div class="label">Denumire firmă</div><input class="input" id="newCoName" placeholder="ex: Unified Media SRL"></div>
                <div class="field"><div class="label">CUI</div><input class="input" id="newCoCui" placeholder="RO... / ..."></div>
                <div class="field"><div class="label">Adresă</div><input class="input" id="newCoAddr" placeholder="adresă"></div>
              </div>
              <div class="row" style="justify-content:flex-end; margin-top:12px">
                <button class="btn btn--primary" id="createCompany">Create company</button>
              </div>
            </div>
            `:''}

            <div class="grid2" style="margin-top:12px">
              <div class="card card--tight">
                <div class="label">Date firmă</div>
                <div class="grid2" style="margin-top:10px">
                  <div class="field"><div class="label">Denumire</div><input class="input" id="cName" value="${escapeHtml(s.company?.name||'')}"></div>
                  <div class="field"><div class="label">CUI</div><input class="input" id="cCui" value="${escapeHtml(s.company?.cui||'')}"></div>
                  <div class="field" style="grid-column:1/-1"><div class="label">Adresă</div><input class="input" id="cAddr" value="${escapeHtml(s.company?.address||'')}"></div>
                  <div class="field"><div class="label">IBAN</div><input class="input" id="cIban" value="${escapeHtml(s.company?.iban||'')}"></div>
                  <div class="field"><div class="label">Banca</div><input class="input" id="cBank" value="${escapeHtml(s.company?.bank||'')}"></div>
                  <div class="field"><div class="label">Email</div><input class="input" id="cEmail" value="${escapeHtml(s.company?.email||'')}"></div>
                  <div class="field"><div class="label">Telefon</div><input class="input" id="cPhone" value="${escapeHtml(s.company?.phone||'')}"></div>
                </div>
              </div>

              <div class="card card--tight">
                <div class="label">Serie facturi</div>
                <div class="grid2" style="margin-top:10px">
                  <div class="field"><div class="label">Prefix serie</div><input class="input" id="sPrefix" value="${escapeHtml(s.series?.prefix||'UBM')}"></div>
                  <div class="field"><div class="label">Următorul număr</div><input class="input" id="sNext" type="number" value="${escapeHtml(s.series?.nextNumber||1)}"></div>
                </div>

                <div style="margin-top:16px" class="label">Pluginuri (MVP)</div>
                <div class="badge">În MVP, modulele sunt built-in. Importul de pluginuri se activează în build-ul următor.</div>
              </div>
            </div>
          </div>
        `;

        // companies
        if (!isAdmin && user){
          root.querySelector('#createCompany')?.addEventListener('click', async ()=>{
            const name = root.querySelector('#newCoName').value.trim();
            if (!name) return api.toast('Firme','Eroare','Numele firmei este obligatoriu');
            const company = {
              id: uid('co'),
              name,
              cui: root.querySelector('#newCoCui').value.trim(),
              address: root.querySelector('#newCoAddr').value.trim(),
              createdAt: Date.now()
            };
            await db.put('companies', company);
            await db.put('memberships', { id: uid('m'), userId: user.id, companyId: company.id, role:'owner', createdAt: Date.now() });
            companies = await loadCompanies();
            await api.auth.setActiveCompany(company.id);
            await api.storage.saveSettings({ company: {
              ...api.storage.getSettings().company,
              name: company.name,
              cui: company.cui,
              address: company.address,
            }});
            api.toast('Firme','Creat','Firma a fost setată ca activă');
            render();
          });

          root.querySelector('#activeCompany')?.addEventListener('change', async (e)=>{
            const id = e.target.value || '';
            await api.auth.setActiveCompany(id);
            const co = companies.find(c=>c.id===id);
            if (co){
              await api.storage.saveSettings({ company: {
                ...api.storage.getSettings().company,
                name: co.name||'',
                cui: co.cui||'',
                address: co.address||'',
              }});
              api.toast('Firme','Activă','Setată');
            }
          });
        }

        root.querySelector('#save').addEventListener('click', async ()=>{
          const patch = {
            company: {
              name: root.querySelector('#cName').value.trim(),
              cui: root.querySelector('#cCui').value.trim(),
              address: root.querySelector('#cAddr').value.trim(),
              iban: root.querySelector('#cIban').value.trim(),
              bank: root.querySelector('#cBank').value.trim(),
              email: root.querySelector('#cEmail').value.trim(),
              phone: root.querySelector('#cPhone').value.trim(),
            },
            series: {
              prefix: root.querySelector('#sPrefix').value.trim() || 'UBM',
              nextNumber: Number(root.querySelector('#sNext').value||1) || 1
            }
          };
          await api.storage.saveSettings(patch);
          api.toast('Setări', 'Salvate', 'OK');
        });
      };
      render();
    },
    unmount:(root)=>{ root.innerHTML=''; }
  });
}
