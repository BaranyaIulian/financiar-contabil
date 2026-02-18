import { store } from './store.js';
import { initRouter } from './router.js';
import { createHost } from './pluginHost.js';
import { toast, escapeHtml, uid } from './utils.js';
import { repos } from '../repos/index.js';
import { promptModal } from './prompt.js';

// Built-in modules
import auth from '../modules/auth/index.js';
import dashboard from '../modules/dashboard/index.js';
import invoice from '../modules/invoice/index.js';
import clients from '../modules/clients/index.js';
import products from '../modules/products/index.js';
import settings from '../modules/settings/index.js';
import efactura from '../modules/efactura/index.js';
import demo from '../modules/demoGenerator/index.js';

const toastHost = document.getElementById('toastHost');
const navEl = document.getElementById('nav');
const crumbEl = document.getElementById('crumb');
const viewRoot = document.getElementById('viewRoot');
const gsInput = document.getElementById('globalSearch');
const gsDrop = document.getElementById('globalSearchDrop');
const userPill = document.getElementById('userPill');
const userName = document.getElementById('userName');
const btnLogout = document.getElementById('btnLogout');

// Account modal opener
const btnAccount = document.getElementById('btnAccount');

// Build / runtime info for debugging (visible in DevTools Console)
try{
  console.groupCollapsed('%c[UBM] Build info','font-weight:700');
  console.log('versions:', window.ubm?.build?.versions);
  console.log('platform:', window.ubm?.build?.platform, window.ubm?.build?.arch);
  console.groupEnd();
}catch{}

const host = createHost({
  store,
  toast: (t,m)=>toast(toastHost,t,m)
});
const api = host.api;

// --- Titlebar global search (pages + quick lookup) ---
let cache = { clients: null, products: null, ts: 0 };
const getCache = async () => {
  const now = Date.now();
  if (!cache.ts || now - cache.ts > 15_000 || !cache.clients || !cache.products){
    try{
      const [clients, products] = await Promise.all([
        repos.clients.list(),
        repos.products.list()
      ]);
      cache = { clients, products, ts: now };
    }catch{
      cache = { ...cache, ts: now };
    }
  }
  return cache;
};

const routeItems = () => {
  const all = api.routes.all().map(r => ({
    kind:'page',
    title: r.title,
    sub: r.path,
    tag: 'Page',
    route: r.path
  }));
  // Put invoice first
  return all.sort((a,b)=> (a.route==='/invoice'?-1:0) - (b.route==='/invoice'?-1:0));
};

const renderDrop = (items, q) => {
  if (!gsDrop) return;
  if (!items.length){ gsDrop.style.display = 'none'; gsDrop.innerHTML=''; return; }
  gsDrop.innerHTML = items.map((it,idx)=>`
    <div class="gsItem" data-idx="${idx}">
      <div class="gsItem__left">
        <div class="gsItem__title">${it.title}</div>
        <div class="gsItem__sub">${it.sub || ''}</div>
      </div>
      <div class="gsItem__tag">${it.tag || ''}</div>
    </div>
  `).join('');
  gsDrop.style.display = 'block';

  gsDrop.querySelectorAll('.gsItem').forEach(row => row.addEventListener('click', async ()=>{
    const it = items[Number(row.dataset.idx)];
    gsDrop.style.display='none';
    if (!it) return;
    if (it.kind === 'page'){
      await api.commands.run('router.go', it.route);
      gsInput.blur();
      return;
    }
    if (it.kind === 'cpv'){
      // Prefer applying to Invoice if open.
      if (store.getState().route !== '/invoice') await api.commands.run('router.go', '/invoice');
      window.dispatchEvent(new CustomEvent('ubm:cpvPick', { detail: { code: it.code, description: it.desc } }));
      gsInput.blur();
      return;
    }
    if (it.kind === 'client'){
      await api.commands.run('router.go', '/customers');
      window.dispatchEvent(new CustomEvent('ubm:focusCustomer', { detail: { id: it.id } }));
      gsInput.blur();
      return;
    }
    if (it.kind === 'product'){
      await api.commands.run('router.go', '/products');
      window.dispatchEvent(new CustomEvent('ubm:focusProduct', { detail: { id: it.id } }));
      gsInput.blur();
      return;
    }
  }));
};

let gsTimer = null;
const runSearch = async () => {
  const q = String(gsInput?.value||'').trim().toLowerCase();
  if (!q){ renderDrop([], ''); return; }

  const res = [];

  // Pages
  for (const it of routeItems()){
    if ((it.title+' '+it.sub).toLowerCase().includes(q)) res.push(it);
    if (res.length >= 7) break;
  }

  // Customers/products
  const c = await getCache();
  if (c.clients?.length){
    for (const cl of c.clients){
      const hay = `${cl.name||''} ${cl.cui||''} ${cl.address||''}`.toLowerCase();
      if (hay.includes(q)) res.push({ kind:'client', title: cl.name || 'Client', sub: cl.cui || '', tag:'Customer', id: cl.id });
      if (res.length >= 10) break;
    }
  }
  if (c.products?.length){
    for (const p of c.products){
      const hay = `${p.name||''} ${p.sku||''}`.toLowerCase();
      if (hay.includes(q)) res.push({ kind:'product', title: p.name || 'Product', sub: p.sku || '', tag:'Product', id: p.id });
      if (res.length >= 12) break;
    }
  }

  // CPV (last)
  const cpv = store.getState().cpv || [];
  if (cpv.length){
    let added = 0;
    for (let i=0;i<cpv.length;i++){
      const it = cpv[i];
      const hay = (it.code+' '+it.description).toLowerCase();
      if (hay.includes(q)){
        res.push({ kind:'cpv', title: `${it.code}`, sub: it.description, tag:'CPV', code: it.code, desc: it.description });
        added++;
      }
      if (added >= 6) break;
    }
  }

  renderDrop(res.slice(0, 14), q);
};

gsInput?.addEventListener('input', ()=>{
  clearTimeout(gsTimer);
  gsTimer = setTimeout(runSearch, 120);
});
gsInput?.addEventListener('focus', ()=>{
  if ((gsInput.value||'').trim()) runSearch();
});
document.addEventListener('click', (e)=>{
  if (!gsDrop || !gsInput) return;
  if (e.target.closest('#globalSearchWrap')) return;
  gsDrop.style.display='none';
});

// Router command for internal navigation
api.commands.add({
  id:'router.go',
  title:'Go',
  run: async (route)=>{
    store.setRoute(route);
    try{
      // Expose route for CSS/layout tweaks (ex: full-bleed invoice preview)
      document.body.dataset.route = String(route||'').replace(/^\//,'') || 'dashboard';
    }catch{}
    crumbEl.textContent = (api.routes.get(route)?.title || route);
    navEl.querySelectorAll('.nav__item').forEach(btn=>{
      btn.classList.toggle('isActive', btn.dataset.route===route);
    });
    mountRoute(route);
  }
});

// Register modules
[auth, dashboard, invoice, clients, products, efactura, settings, demo].forEach(m => m(api));

function applyAuthUI(){
  const a = store.getState().auth;
  const logged = !!a.user;
  document.body.classList.toggle('authMode', !logged);
  if (userPill) userPill.style.display = logged ? 'inline-flex' : 'none';
  if (userName) userName.textContent = logged ? `${a.user.username}${a.user.role==='admin'?' (admin)':''}` : '';
}

async function openAccountModal(){
  const a = api.auth.get();
  const user = a?.user;
  if (!user) return;

  const overlay = document.createElement('div');
  overlay.className = 'ubmModalOverlay';
  const modal = document.createElement('div');
  modal.className = 'ubmModal';
  modal.style.width = 'min(860px, calc(100vw - 28px))';
  modal.innerHTML = `
    <div class="ubmModal__head" style="display:flex; align-items:center; justify-content:space-between; gap:12px">
      <div>
        <div class="ubmModal__title">Account</div>
        <div style="font-size:12px; color:var(--muted); margin-top:4px">${escapeHtml(user.username)}${user.role==='admin'?' · admin':''}</div>
      </div>
      <button class="btn" data-act="close">Close</button>
    </div>
    <div class="ubmModal__body">
      <div class="row" style="gap:8px; margin-bottom:12px">
        <button class="btn" data-tab="profile">Profile</button>
        <button class="btn" data-tab="companies">Companies</button>
      </div>

      <div data-pane="profile">
        <div class="card card--tight">
          <div class="label">Change password</div>
          <div class="grid2" style="margin-top:10px">
            <div class="field"><div class="label">Current password</div><input class="input" id="curPass" type="password" autocomplete="current-password"></div>
            <div class="field"><div class="label">New password</div><input class="input" id="newPass" type="password" autocomplete="new-password"></div>
          </div>
          <div class="row" style="justify-content:flex-end; margin-top:12px">
            <button class="btn btn--primary" id="btnSavePass">Update</button>
          </div>
        </div>
      </div>

      <div data-pane="companies" style="display:none">
        ${user.role==='admin' ? `
          <div class="badge">Admin account folosește firma implicită (admin_default). Conturile "user" pot crea firme proprii.</div>
        ` : `
          <div class="card card--tight">
            <div class="row" style="justify-content:space-between; align-items:center">
              <div>
                <div class="label">Your companies</div>
                <div class="p" style="margin:6px 0 0">Creează, editează sau șterge firme. Poți seta și firma activă.</div>
              </div>
              <button class="btn btn--primary" id="btnNewCompany">New</button>
            </div>
            <div id="companiesList" style="margin-top:12px"></div>
          </div>
        `}
      </div>
    </div>
  `;

  const close = ()=> overlay.remove();
  overlay.addEventListener('click', (e)=>{ if (e.target===overlay) close(); });
  modal.querySelector('[data-act="close"]').addEventListener('click', close);

  // tabs
  const showTab = (t)=>{
    modal.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('btn--primary', b.dataset.tab===t));
    modal.querySelectorAll('[data-pane]').forEach(p=>p.style.display = (p.dataset.pane===t)?'block':'none');
  };
  modal.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click', ()=>showTab(b.dataset.tab)));
  showTab('profile');

  // password update
  modal.querySelector('#btnSavePass')?.addEventListener('click', async ()=>{
    try{
      const currentPassword = modal.querySelector('#curPass').value;
      const newPassword = modal.querySelector('#newPass').value;
      await api.auth.updatePassword({ currentPassword, newPassword });
      modal.querySelector('#curPass').value='';
      modal.querySelector('#newPass').value='';
      api.toast('Account','Updated','Password changed');
    }catch(e){
      api.toast('Account','Error', e?.message || 'Failed');
    }
  });

  // companies management (non-admin)
  const loadMyCompanies = async ()=>{
    const [companies, memberships] = await Promise.all([repos.companies.list(), repos.memberships.list()]);
    const my = new Set(memberships.filter(m=>m.userId===user.id).map(m=>m.companyId));
    return companies.filter(c=>my.has(c.id));
  };
  const renderCompanies = async ()=>{
    if (user.role==='admin') return;
    const list = modal.querySelector('#companiesList');
    if (!list) return;
    const companies = await loadMyCompanies();
    if (!companies.length){
      list.innerHTML = `<div class="badge">Nu ai firme încă. Apasă <b>New</b> pentru a crea una.</div>`;
      return;
    }
    const active = api.auth.get().activeCompanyId;
    list.innerHTML = companies.map(c=>`
      <div class="card card--tight" style="margin-top:10px">
        <div class="row" style="justify-content:space-between; align-items:center">
          <div>
            <div style="font-weight:800">${escapeHtml(c.name||'Firma')}</div>
            <div style="font-size:12px; color:var(--muted); margin-top:4px">${escapeHtml(c.cui||'')} ${c.address?` · ${escapeHtml(c.address)}`:''}</div>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn" data-act="set" data-id="${escapeHtml(c.id)}">${active===c.id?'Active':'Set active'}</button>
            <button class="btn" data-act="edit" data-id="${escapeHtml(c.id)}">Edit</button>
            <button class="btn" data-act="del" data-id="${escapeHtml(c.id)}">Delete</button>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('button[data-act]').forEach(btn=>btn.addEventListener('click', async ()=>{
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const companiesNow = await loadMyCompanies();
      const co = companiesNow.find(x=>x.id===id);
      if (!co) return;

      if (act==='set'){
        await api.auth.setActiveCompany(co.id);
        await api.storage.saveSettings({ company: {
          ...api.storage.getSettings().company,
          name: co.name||'',
          cui: co.cui||'',
          address: co.address||'',
        }});
        api.toast('Firme','Activă','Setată');
        renderCompanies();
        return;
      }

      if (act==='edit'){
        const name = await promptModal({ title:'Edit company', label:'Name', value: co.name||'' });
        if (name===null) return;
        const cui = await promptModal({ title:'Edit company', label:'CUI', value: co.cui||'' });
        if (cui===null) return;
        const address = await promptModal({ title:'Edit company', label:'Address', value: co.address||'' });
        if (address===null) return;
        await repos.companies.put({ ...co, name: String(name).trim(), cui: String(cui).trim(), address: String(address).trim(), updatedAt: Date.now() });
        if (api.auth.get().activeCompanyId === co.id){
          await api.storage.saveSettings({ company: {
            ...api.storage.getSettings().company,
            name: String(name).trim(),
            cui: String(cui).trim(),
            address: String(address).trim(),
          }});
        }
        api.toast('Firme','Updated','OK');
        renderCompanies();
        return;
      }

      if (act==='del'){
        const ok = await promptModal({ title:'Delete company', label:`Type DELETE to confirm`, placeholder:'DELETE', value:'' , okText:'Delete', cancelText:'Cancel'});
        if (ok !== 'DELETE') return;
        await repos.companies.del(co.id);
        const memberships = await repos.memberships.list();
        const toDel = memberships.filter(m=>m.companyId===co.id && m.userId===user.id);
        for (const m of toDel) await repos.memberships.del(m.id);
        if (api.auth.get().activeCompanyId === co.id){
          await api.auth.setActiveCompany('');
        }
        api.toast('Firme','Deleted','OK');
        renderCompanies();
      }
    }));
  };

  modal.querySelector('#btnNewCompany')?.addEventListener('click', async ()=>{
    try{
      const name = await promptModal({ title:'New company', label:'Name', placeholder:'ex: Unified Media SRL' });
      if (name===null) return;
      const cui = await promptModal({ title:'New company', label:'CUI', placeholder:'RO...' });
      if (cui===null) return;
      const address = await promptModal({ title:'New company', label:'Address', placeholder:'Address' });
      if (address===null) return;
      const company = { id: uid('co'), name: String(name).trim(), cui: String(cui).trim(), address: String(address).trim(), createdAt: Date.now() };
      await repos.companies.put(company);
      await repos.memberships.put({ id: uid('m'), userId: user.id, companyId: company.id, role:'owner', createdAt: Date.now() });
      await api.auth.setActiveCompany(company.id);
      await api.storage.saveSettings({ company: {
        ...api.storage.getSettings().company,
        name: company.name,
        cui: company.cui,
        address: company.address,
      }});
      api.toast('Firme','Created','Firma setată ca activă');
      renderCompanies();
    }catch(e){
      api.toast('Firme','Error', e?.message || 'Failed');
    }
  });

  renderCompanies();

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

btnLogout?.addEventListener('click', async ()=>{
  await api.auth.logout();
  await api.commands.run('router.go','/auth');
});

btnAccount?.addEventListener('click', openAccountModal);

// window controls
const btnMin = document.getElementById('btnMin');
const btnMax = document.getElementById('btnMax');
const btnClose = document.getElementById('btnClose');

btnMin?.addEventListener('click', ()=> window.ubm?.window?.minimize());
btnClose?.addEventListener('click', ()=> window.ubm?.window?.close());
btnMax?.addEventListener('click', async ()=>{
  const res = await window.ubm?.window?.toggleMaximize();
  btnMax?.classList.toggle('isMax', !!res?.maximized);
});
(async ()=>{
  const res = await window.ubm?.window?.isMaximized();
  btnMax?.classList.toggle('isMax', !!res?.maximized);
})()

// double-click titlebar to toggle maximize (Windows-like behavior)
const titlebarEl = document.getElementById('titlebar');
titlebarEl?.addEventListener('dblclick', async (e)=>{
  // ignore dblclick on interactive controls
  if (e.target?.closest?.('button, a, input, textarea, select, .globalSearch, .macControls')) return;
  const res = await window.ubm?.window?.toggleMaximize?.();
  btnMax?.classList.toggle('isMax', !!res?.maximized);
});
;

// Sidebar demo buttons
document.getElementById('btnDemo').addEventListener('click', ()=> api.commands.run('demo.generate'));
document.getElementById('btnReset').addEventListener('click', ()=> api.commands.run('demo.reset'));

// Load CPV strictly from bundled json via preload (Electron-safe, no fetch problems)
async function loadCPV(){
  const txt = await window.ubm.assets.readText('data/cpv_ro.json');
  const list = JSON.parse(txt);
  // normalize
  const norm = (Array.isArray(list)?list:[]).map(x=>({
    code: String(x.code||'').trim(),
    description: String(x.description||x.desc||'').trim()
  })).filter(x=>x.code && x.description);
  store.setCPV(norm);
  console.log('CPV loaded:', norm.length);
}

let currentUnmount = null;
async function mountRoute(route){
  const authState = store.getState().auth;
  const isAuthRoute = (route === '/auth');
  if (authState.loaded && !authState.user && !isAuthRoute){
    route = '/auth';
    store.setRoute('/auth');
  }
  const r = api.routes.get(route) || api.routes.get('/dashboard');
  if (currentUnmount) { try{ currentUnmount(); }catch{} currentUnmount=null; }
  viewRoot.innerHTML = '';
  if (!r) return;
  await r.mount(viewRoot);
  currentUnmount = () => r.unmount?.(viewRoot);
}

// Boot
await store.loadBoot();
applyAuthUI();
await loadCPV();
initRouter(store, navEl, crumbEl);
// If not logged-in, start at /auth
if (!store.getState().auth.user) store.setRoute('/auth');
mountRoute(store.getState().route);
try{ document.body.dataset.route = String(store.getState().route||'').replace(/^\//,'') || 'dashboard'; }catch{}

// also react if route changed by sidebar
store.on('route', (route)=> mountRoute(route));

store.on('auth', ()=>{
  applyAuthUI();
  const a = store.getState().auth;
  if (!a.user){
    api.commands.run('router.go','/auth');
  }
});
