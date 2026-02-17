import { db } from '../../core/db.js';
import { uid, escapeHtml } from '../../core/utils.js';
import { promptModal } from '../../core/prompt.js';

export default function register(api){
  api.routes.add({
    path:'/products',
    title:'Produse',
    mount: async (root) => {
      const render = async ()=>{
        const items = await db.list('products');
        root.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between; align-items:center">
              <div>
                <h1 class="h1">Produse</h1>
                <p class="p">Nomenclator local (se folosește la liniile din factură).</p>
              </div>
              <button class="btn btn--primary" id="add">+ Adaugă produs</button>
            </div>
            <table class="table">
              <thead><tr><th>Denumire</th><th>UM</th><th>Preț</th><th>TVA</th><th></th></tr></thead>
              <tbody>
                ${items.map(p=>`
                  <tr>
                    <td>${escapeHtml(p.name||'')}</td>
                    <td>${escapeHtml(p.um||'buc')}</td>
                    <td>${escapeHtml(String(p.price||0))}</td>
                    <td>${escapeHtml(String(p.vat||19))}%</td>
                    <td style="text-align:right">
                      <button class="btn btn--ghost" data-edit="${p.id}">Edit</button>
                      <button class="btn btn--ghost" data-del="${p.id}">Del</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        root.querySelector('#add').addEventListener('click', async ()=>{
          const name = await promptModal({ title:'Adaugă produs', label:'Denumire produs', placeholder:'Ex: Servicii consultanță' });
          if (!name) return;
          const um = await promptModal({ title:'Adaugă produs', label:'UM (ex: buc, ora)', value:'buc' }) || 'buc';
          const price = Number(await promptModal({ title:'Adaugă produs', label:'Preț (număr)', value:'0' }) || 0);
          const vat = Number(await promptModal({ title:'Adaugă produs', label:'TVA %', value:'19' }) || 19);
          await db.put('products', { id: uid('p'), name, um, price, vat, createdAt: Date.now() });
          api.toast('Produs', 'Salvat', name);
          render();
        });
        root.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click', async ()=>{
          const p = await db.get('products', btn.dataset.edit); if (!p) return;
          const name = (await promptModal({ title:'Editează produs', label:'Denumire', value: p.name || '' })) ?? p.name;
          const um = (await promptModal({ title:'Editează produs', label:'UM', value: p.um || 'buc' })) ?? p.um;
          const price = Number((await promptModal({ title:'Editează produs', label:'Preț', value: String(p.price ?? 0) })) ?? p.price ?? 0);
          const vat = Number((await promptModal({ title:'Editează produs', label:'TVA %', value: String(p.vat ?? 19) })) ?? p.vat ?? 19);
          await db.put('products', { ...p, name, um, price, vat, updatedAt: Date.now() });
          render();
        }));
        root.querySelectorAll('[data-del]').forEach(btn=>btn.addEventListener('click', async ()=>{
          if (!confirm('Ștergi produsul?')) return;
          await db.del('products', btn.dataset.del);
          render();
        }));
      };
      render();
    },
    unmount: (root)=>{ root.innerHTML=''; }
  });
}
