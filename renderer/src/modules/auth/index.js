import { escapeHtml } from '../../core/utils.js';

export default function register(api){
  api.routes.add({
    path:'/auth',
    title:'Login',
    mount: async (root) => {
      root.innerHTML = `
        <div class="authWrap">
          <div class="authCard">
            <div class="authHead">
              <div class="authLogo">U</div>
              <div>
                <div class="authTitle">Unified Billing</div>
                <div class="authSub">Logare / creare cont (local-first)</div>
              </div>
            </div>

            <div class="authTabs">
              <button class="authTab isActive" data-tab="login">Login</button>
              <button class="authTab" data-tab="signup">Create account</button>
            </div>

            <div class="authPane" data-pane="login">
              <div class="field"><div class="label">Username</div><input class="input" id="lUser" placeholder="admin" autocomplete="username"></div>
              <div class="field"><div class="label">Password</div><input class="input" id="lPass" type="password" placeholder="admin" autocomplete="current-password"></div>
              <button class="btn btn--primary" id="btnLogin" style="width:100%; margin-top:10px">Login</button>
              <div class="authHint">Cont implicit: <b>admin</b> / <b>admin</b></div>
            </div>

            <div class="authPane" data-pane="signup" style="display:none">
              <div class="field"><div class="label">Username</div><input class="input" id="sUser" placeholder="ex: shen" autocomplete="username"></div>
              <div class="field"><div class="label">Password</div><input class="input" id="sPass" type="password" placeholder="min 4 caractere" autocomplete="new-password"></div>
              <button class="btn btn--primary" id="btnSignup" style="width:100%; margin-top:10px">Create account</button>
              <div class="authHint">După creare, te poți loga imediat.</div>
            </div>

            <div class="authErr" id="authErr" style="display:none"></div>
          </div>
        </div>
      `;

      const err = (m)=>{
        const el = root.querySelector('#authErr');
        el.textContent = m;
        el.style.display = 'block';
      };
      const clearErr = ()=>{
        const el = root.querySelector('#authErr');
        el.textContent = '';
        el.style.display = 'none';
      };

      root.querySelectorAll('.authTab').forEach(b=>b.addEventListener('click', ()=>{
        clearErr();
        root.querySelectorAll('.authTab').forEach(x=>x.classList.toggle('isActive', x===b));
        const tab = b.dataset.tab;
        root.querySelectorAll('.authPane').forEach(p=>p.style.display = (p.dataset.pane===tab)?'block':'none');
      }));

      root.querySelector('#btnLogin').addEventListener('click', async ()=>{
        clearErr();
        const u = root.querySelector('#lUser').value;
        const p = root.querySelector('#lPass').value;
        try{
          await api.auth.login(u,p);
          await api.commands.run('router.go','/dashboard');
          api.toast('Login','Succes','Bun venit');
        }catch(e){
          err(e?.message || 'Login failed');
        }
      });

      root.querySelector('#btnSignup').addEventListener('click', async ()=>{
        clearErr();
        const u = root.querySelector('#sUser').value;
        const p = root.querySelector('#sPass').value;
        try{
          await api.auth.createAccount({ username:u, password:p });
          api.toast('Account','Creat','Te poți loga acum');
          // switch to login
          root.querySelector('.authTab[data-tab="login"]').click();
          root.querySelector('#lUser').value = String(u||'').trim().toLowerCase();
          root.querySelector('#lPass').value = '';
          root.querySelector('#lPass').focus();
        }catch(e){
          err(e?.message || 'Create failed');
        }
      });

      // Enter to submit
      root.addEventListener('keydown', (e)=>{
        if (e.key !== 'Enter') return;
        const loginVisible = root.querySelector('[data-pane="login"]').style.display !== 'none';
        if (loginVisible) root.querySelector('#btnLogin').click();
        else root.querySelector('#btnSignup').click();
      });
    },
    unmount:(root)=>{ root.innerHTML=''; }
  });
}
