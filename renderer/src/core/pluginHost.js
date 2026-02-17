/**
 * Minimal plugin host.
 * Built-in modules register routes and commands.
 * Later you can add external plugins by reading plugins/manifest.json via preload.
 */
export function createHost({ store, toast }){
  const routes = new Map();
  const commands = new Map();
  const exporters = new Map();

  const api = {
    routes: {
      add: (r) => routes.set(r.path, r),
      get: (path) => routes.get(path),
      all: () => Array.from(routes.values()),
    },
    commands: {
      add: (c) => commands.set(c.id, c),
      run: async (id, ...args) => commands.get(id)?.run?.(...args),
    },
    exporters: {
      add: (x) => exporters.set(x.id, x),
      get: (id) => exporters.get(id),
    },
    storage: {
      getSettings: () => store.getState().settings,
      saveSettings: (patch) => store.saveSettings(patch),
    },
    auth: {
      get: () => store.getState().auth,
      login: (u,p) => store.login(u,p),
      logout: () => store.logout(),
      createAccount: (payload) => store.createAccount(payload),
      setActiveCompany: (id) => store.setActiveCompany(id),
      updatePassword: (payload) => store.updatePassword(payload),
    },
    data: {
      getCPV: () => store.getState().cpv,
    },
    toast
  };

  return { api };
}
