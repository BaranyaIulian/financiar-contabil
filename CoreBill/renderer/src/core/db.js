/**
 * IndexedDB wrapper
 * DB: ubm_core
 * Stores: settings (key->value), clients, products, invoices, efactura
 */
const DB_NAME = 'ubm_core';
const DB_VERSION = 2;

function openDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      for (const name of ['clients','products','invoices','efactura']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }

      // Auth + multi-company
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('companies')) db.createObjectStore('companies', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('memberships')) db.createObjectStore('memberships', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(storeName, mode, fn){
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    const res = fn(store);
    t.oncomplete = () => resolve(res);
    t.onerror = () => reject(t.error);
  });
}
export const db = {
  async kvGet(key){
    const dbi = await openDb();
    return new Promise((resolve, reject)=>{
      const t = dbi.transaction('kv','readonly');
      const r = t.objectStore('kv').get(key);
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
  },
  async kvSet(key, value){
    const dbi = await openDb();
    return new Promise((resolve, reject)=>{
      const t = dbi.transaction('kv','readwrite');
      t.objectStore('kv').put(value, key);
      t.oncomplete=()=>resolve(true);
      t.onerror=()=>reject(t.error);
    });
  },
  async list(storeName){
    const dbi = await openDb();
    return new Promise((resolve, reject)=>{
      const t = dbi.transaction(storeName,'readonly');
      const r = t.objectStore(storeName).getAll();
      r.onsuccess=()=>resolve(r.result||[]);
      r.onerror=()=>reject(r.error);
    });
  },
  async get(storeName, id){
    const dbi = await openDb();
    return new Promise((resolve, reject)=>{
      const t = dbi.transaction(storeName,'readonly');
      const r = t.objectStore(storeName).get(id);
      r.onsuccess=()=>resolve(r.result||null);
      r.onerror=()=>reject(r.error);
    });
  },
  async put(storeName, obj){
    const dbi = await openDb();
    return new Promise((resolve, reject)=>{
      const t = dbi.transaction(storeName,'readwrite');
      t.objectStore(storeName).put(obj);
      t.oncomplete=()=>resolve(obj);
      t.onerror=()=>reject(t.error);
    });
  },
  async del(storeName, id){
    const dbi = await openDb();
    return new Promise((resolve, reject)=>{
      const t = dbi.transaction(storeName,'readwrite');
      t.objectStore(storeName).delete(id);
      t.oncomplete=()=>resolve(true);
      t.onerror=()=>reject(t.error);
    });
  },
  async clearAll(){
    const dbi = await openDb();
    const stores = Array.from(dbi.objectStoreNames);
    for (const s of stores){
      await new Promise((resolve, reject)=>{
        const t = dbi.transaction(s,'readwrite');
        t.objectStore(s).clear();
        t.oncomplete=()=>resolve(true);
        t.onerror=()=>reject(t.error);
      });
    }
  }
};
