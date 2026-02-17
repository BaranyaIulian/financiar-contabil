export default function register(api){
  api.routes.add({
    path:'/bank',
    title:'Bank Transactions',
    mount: async (root) => {
      root.innerHTML = `
        <div class="card">
          <h1 class="h1">Bank Transactions</h1>
          <p class="p">MVP placeholder. În build-ul următor conectăm import CSV/MT940/JSON + matching automat cu facturi.</p>
          <div class="badge">Coming soon</div>
        </div>
      `;
    },
    unmount:(root)=>{ root.innerHTML=''; }
  });
}
