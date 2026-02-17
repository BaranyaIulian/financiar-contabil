import { db } from './db.js';
import { sha256, uid } from './utils.js';

const listeners = new Map();

const state = {
  route: '/dashboard',
  auth: {
    user: null,
    loaded: false,
    activeCompanyId: null,
  },
  cpv: [],
  cpvLoaded: false,
  settings: {
    company: { name:'', cui:'', address:'', bank:'', iban:'', email:'', phone:'', city:'', county:'' },
    series: { prefix:'UBM', nextNumber: 1 },
  },
  currentInvoiceId: null,
};

export const store = {
  getState: () => state,
  on: (evt, cb) => {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(cb);
    return () => listeners.get(evt)?.delete(cb);
  },
  emit: (evt, payload) => {
    (listeners.get(evt) || []).forEach(cb => cb(payload));
  },
  setRoute: (route) => { state.route = route; store.emit('route', route); },
  async loadBoot(){
    const settings = await db.kvGet('settings');
    if (settings) state.settings = settings;
    store.emit('settings', state.settings);

    await store.loadAuth();
  },

  // -------- Auth / Session --------
  async ensureAdmin(){
    const admin = await db.get('users','admin');
    if (admin) return;
    const passHash = await sha256('admin');
    await db.put('users', {
      id:'admin',
      username:'admin',
      passHash,
      role:'admin',
      createdAt: Date.now()
    });
  },

  async loadAuth(){
    await store.ensureAdmin();
    const session = await db.kvGet('session');
    const userId = session?.userId || null;
    if (userId){
      const user = await db.get('users', userId);
      state.auth.user = user || null;
      state.auth.activeCompanyId = session?.activeCompanyId || null;
      if (user?.role === 'admin' && !state.auth.activeCompanyId){
        state.auth.activeCompanyId = 'admin_default';
      }
    }else{
      state.auth.user = null;
      state.auth.activeCompanyId = null;
    }
    state.auth.loaded = true;
    store.emit('auth', { ...state.auth });
  },

  async login(username, password){
    await store.ensureAdmin();
    const id = String(username||'').trim().toLowerCase();
    const user = await db.get('users', id);
    if (!user) throw new Error('User not found');
    const passHash = await sha256(password||'');
    if (passHash !== user.passHash) throw new Error('Wrong password');
    state.auth.user = user;
    if (user.role === 'admin') state.auth.activeCompanyId = 'admin_default';
    await db.kvSet('session', { userId: user.id, activeCompanyId: state.auth.activeCompanyId });
    store.emit('auth', { ...state.auth });
    return user;
  },

  async logout(){
    state.auth.user = null;
    state.auth.activeCompanyId = null;
    await db.kvSet('session', null);
    store.emit('auth', { ...state.auth });
  },

  async createAccount({ username, password }){
    await store.ensureAdmin();
    const id = String(username||'').trim().toLowerCase();
    if (!id || id.length < 3) throw new Error('Username too short');
    if (id === 'admin') throw new Error('Reserved username');
    const exists = await db.get('users', id);
    if (exists) throw new Error('User already exists');
    const passHash = await sha256(password||'');
    if (!password || String(password).length < 4) throw new Error('Password too short');
    const user = { id, username: id, passHash, role:'user', createdAt: Date.now() };
    await db.put('users', user);
    return user;
  },

  async updatePassword({ currentPassword, newPassword }){
    const user = state.auth.user;
    if (!user) throw new Error('Not logged in');
    if (!newPassword || String(newPassword).length < 4) throw new Error('Password too short');
    const curHash = await sha256(currentPassword || '');
    if (curHash !== user.passHash) throw new Error('Wrong current password');
    const passHash = await sha256(newPassword);
    const next = { ...user, passHash, updatedAt: Date.now() };
    await db.put('users', next);
    state.auth.user = next;
    store.emit('auth', { ...state.auth });
    return true;
  },

  async setActiveCompany(companyId){
    state.auth.activeCompanyId = companyId || null;
    const sess = await db.kvGet('session');
    if (sess?.userId) await db.kvSet('session', { ...sess, activeCompanyId: state.auth.activeCompanyId });
    store.emit('auth', { ...state.auth });
  },
  async saveSettings(patch){
    state.settings = { ...state.settings, ...patch };
    await db.kvSet('settings', state.settings);
    store.emit('settings', state.settings);
  },
  setCPV(list){
    state.cpv = list;
    state.cpvLoaded = true;
    store.emit('cpv', list);
  }
};
