import { repos } from '../../repos/index.js';
import { uid } from '../../core/utils.js';

export default function register(api){
  api.commands.add({
    id:'demo.generate',
    title:'Generate demo',
    run: async ()=>{
      // company settings
      const s = api.storage.getSettings();
      if (!s.company?.name){
        await api.storage.saveSettings({
          company:{ name:'Unified Media SRL', cui:'RO12345678', address:'Timișoara, România', iban:'RO00BANK0000000000000000', bank:'Banca Demo', email:'office@unified.local', phone:'07xx xxx xxx' },
          series:{ prefix:'UBM', nextNumber: 1 }
        });
      }

      const c1 = { id: uid('c'), name:'Client Demo SRL', cui:'RO87654321', address:'Cluj-Napoca, România', createdAt: Date.now() };
      await repos.clients.put(c1);

      const p1 = { id: uid('p'), name:'Servicii producție video', um:'ora', price:450, vat:19, createdAt: Date.now() };
      const p2 = { id: uid('p'), name:'Servicii editare', um:'ora', price:35, vat:19, createdAt: Date.now() };
      await repos.products.put(p1);
      await repos.products.put(p2);

      const cpv = api.data.getCPV();
      const pick = (q) => cpv.find(x=>x.description.toLowerCase().includes(q)) || cpv[Math.floor(Math.random()*cpv.length)];
      const inv = {
        id: uid('inv'),
        series: s.series?.prefix || 'UBM',
        number: s.series?.nextNumber || 1,
        date: new Date().toISOString().slice(0,10),
        dueDays: 30,
        currency: 'RON',
        companySnapshot: api.storage.getSettings().company || {},
        clientId: c1.id,
        clientSnapshot: c1,
        items: [
          { id: uid('it'), desc:p1.name, qty:1, price:p1.price, vat:p1.vat, cpvCode: pick('publicitate')?.code || '', cpvDesc: pick('publicitate')?.description || '', nc:'' },
          { id: uid('it'), desc:p2.name, qty:3, price:p2.price, vat:p2.vat, cpvCode: pick('informat')?.code || '', cpvDesc: pick('informat')?.description || '', nc:'' },
        ],
        notes: 'Factură demo generată automat.',
        createdAt: Date.now()
      };
      await repos.invoices.put(inv);

      api.toast('Demo', 'Generat', 'Client + produse + factură');
    }
  });

  api.commands.add({
    id:'demo.reset',
    title:'Reset',
    run: async ()=>{
      await repos._unsafe.clearAll();
      api.toast('Reset', 'OK', 'IndexedDB curățat');
      location.reload();
    }
  });
}
