// Minimal modal prompt replacement (Electron disables window.prompt in many configs)

function el(tag, attrs={}, html=''){
  const n = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === 'class') n.className = v;
    else if (k === 'style') n.setAttribute('style', v);
    else n.setAttribute(k, String(v));
  }
  if (html) n.innerHTML = html;
  return n;
}

export async function promptModal({ title='Input', label='', placeholder='', value='', okText='OK', cancelText='Cancel' }={}){
  return new Promise((resolve)=>{
    const overlay = el('div', { class:'ubmModalOverlay' });
    const modal = el('div', { class:'ubmModal' });
    modal.innerHTML = `
      <div class="ubmModal__head">
        <div class="ubmModal__title"></div>
      </div>
      <div class="ubmModal__body">
        ${label ? `<div class="ubmModal__label"></div>` : ''}
        <input class="ubmModal__input" />
      </div>
      <div class="ubmModal__actions">
        <button class="btn" data-act="cancel">${cancelText}</button>
        <button class="btn primary" data-act="ok">${okText}</button>
      </div>
    `;

    const titleEl = modal.querySelector('.ubmModal__title');
    titleEl.textContent = title;
    const labelEl = modal.querySelector('.ubmModal__label');
    if (labelEl) labelEl.textContent = label;

    const input = modal.querySelector('.ubmModal__input');
    input.placeholder = placeholder;
    input.value = value ?? '';

    const close = (val)=>{
      overlay.remove();
      resolve(val);
    };

    overlay.addEventListener('click', (e)=>{
      if (e.target === overlay) close(null);
    });

    modal.querySelector('[data-act="cancel"]').addEventListener('click', ()=>close(null));
    modal.querySelector('[data-act="ok"]').addEventListener('click', ()=>close(input.value));
    input.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') { e.preventDefault(); close(input.value); }
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(()=>input.focus(), 0);
  });
}
