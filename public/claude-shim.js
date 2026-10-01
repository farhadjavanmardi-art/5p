// Stand-in for the claude.ai page runtime (window.claude.use), so app.html runs unchanged outside Claude:
//   sample    -> POST /api/generate on our own server (which holds the API key)
//   db        -> this browser's localStorage
//   user      -> a single local user
//   downloads -> a normal file download
(() => {
  const PREFIX = "5p:";
  const store = {
    get(k) { try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : undefined; } catch { return undefined; } },
    set(k, v) { localStorage.setItem(PREFIX + k, JSON.stringify(v)); },
    keys(prefix) { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(PREFIX + prefix)) out.push(k.slice(PREFIX.length)); } } catch {} return out; },
  };

  const db = {
    collection(col) {
      return {
        doc(id) {
          const key = col + "/" + id;
          return {
            async set(obj) { store.set(key, obj); },
            async get() { const v = store.get(key); return { id, exists: v !== undefined, data: () => v }; },
          };
        },
        async get() {
          const docs = store.keys(col + "/").map((k) => { const id = k.slice(col.length + 1); const v = store.get(k); return { id, data: () => v }; });
          return { docs };
        },
      };
    },
  };

  const user = { async id() { return "local"; }, isOwner: () => true, canEdit: () => true };

  const downloads = {
    async save({ filename, data }) {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = Object.assign(document.createElement("a"), { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
  };

  async function ask(prompt, opts = {}) {
    let res;
    try {
      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: opts.signal,
      });
    } catch (e) {
      if (e && e.name === "AbortError") throw { code: "cancelled", message: "متوقف شد." };
      throw { code: "network", message: "سرور در دسترس نیست. آیا npm start اجرا شده؟" };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw { code: body.code || "server_error", message: body.message || "خطای سرور" };
    return body.data;
  }
  const sample = Object.assign((input, opts) => ask(input, opts).then((d) => ({ text: JSON.stringify(d), truncated: false })), { json: ask });

  const caps = { db, user, downloads, sample };
  window.claude = { use: async (name) => caps[name] ?? null };
})();
