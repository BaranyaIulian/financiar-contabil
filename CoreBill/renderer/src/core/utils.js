export function escapeHtml(s=''){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}
export function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
export function money(n){
  const x = Number(n||0);
  return x.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

export function toast(host, title, msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="toast__t">${escapeHtml(title)}</div><div class="toast__m">${escapeHtml(msg||'')}</div>`;
  host.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(6px)'; }, 3500);
  setTimeout(()=>{ el.remove(); }, 4200);
}

export async function sha256(text=''){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(text)));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
