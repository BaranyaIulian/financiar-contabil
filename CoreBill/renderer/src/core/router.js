export function initRouter(store, navEl, crumbEl){
  function setActive(route){
    navEl.querySelectorAll('.nav__item').forEach(btn=>{
      const on = btn.dataset.route === route;
      btn.classList.toggle('isActive', on);
    });
  }
  navEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('.nav__item');
    if (!btn) return;
    store.setRoute(btn.dataset.route);
    crumbEl.textContent = btn.dataset.crumb || btn.querySelector('.nav__label')?.textContent?.trim() || btn.textContent.trim();
    setActive(btn.dataset.route);
  });
  // initial
  setActive(store.getState().route);
}
