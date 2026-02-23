import { db } from '../../core/db.js';
import { uid, escapeHtml } from '../../core/utils.js';
import { promptModal } from '../../core/prompt.js';

export default function register(api){
  api.routes.add({
    path:'/clients',
    title:'Clienți',
    mount: async (root) => {
      const render = async ()=>{
        const clients = await db.list('clients');
        root.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between; align-items:center">
              <div>
                <h1 class="h1">Clienți</h1>
                <p class="p">Nomenclator local.</p>
              </div>
              <button class="btn btn--primary" id="add">+ Adaugă client</button>
            </div>
            <table class="table">
              <thead><tr><th>Nume</th><th>CUI</th><th>Adresă</th><th></th></tr></thead>
              <tbody>
                ${clients.map(c=>`
                  <tr>
                    <td>${escapeHtml(c.name||'')}</td>
                    <td>${escapeHtml(c.cui||'')}</td>
                    <td>${escapeHtml(c.address||'')}</td>
                    <td style="text-align:right">
                      <button class="btn btn--ghost" data-edit="${c.id}">Edit</button>
                      <button class="btn btn--ghost" data-del="${c.id}">Del</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        root.querySelector('#add').addEventListener('click', async ()=>{
          const name = await promptModal({ title:'Adaugă client', label:'Nume client', placeholder:'Ex: Client Demo SRL' });
          if (!name) return;
          const cui = await promptModal({ title:'Adaugă client', label:'CUI (opțional)', placeholder:'Ex: RO12345678' }) || '';
          const address = await promptModal({ title:'Adaugă client', label:'Adresă (opțional)', placeholder:'Strada, oraș, țară' }) || '';
          await db.put('clients', { id: uid('c'), name, cui, address, createdAt: Date.now() });
          api.toast('Client', 'Salvat', name);
          render();
        });
        root.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click', async ()=>{
          const id = btn.dataset.edit;
          const c = await db.get('clients', id);
          if (!c) return;
          const name = (await promptModal({ title:'Editează client', label:'Nume', value: c.name || '' })) ?? c.name;
          const cui = (await promptModal({ title:'Editează client', label:'CUI', value: c.cui || '' })) ?? c.cui;
          const address = (await promptModal({ title:'Editează client', label:'Adresă', value: c.address || '' })) ?? c.address;
          await db.put('clients', { ...c, name, cui, address, updatedAt: Date.now() });
          render();
        }));
        root.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click', async ()=>{
          const id = btn.dataset.del;
          if (!confirm('Ștergi clientul?')) return;
          await db.del('clients', id);
          render();
        }));
      };
      render();
    },
    unmount: (root)=>{ root.innerHTML=''; }
  });
}
