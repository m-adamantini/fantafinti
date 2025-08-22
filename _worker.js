export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/notes") {
      const origin = request.headers.get("Origin") || "";
      const allowed = env.ALLOWED_ORIGIN || origin || "*";
      const cors = {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "content-type, authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      };
      if (request.method === "OPTIONS") return new Response(null, { headers: cors });

      const key = "notes-v2";

      if (request.method === "GET") {
        const json = await env.NOTES_KV.get(key);
        const empty = { notes: {} };
        return new Response(json || JSON.stringify(empty), { headers: { "Content-Type":"application/json", ...cors }});
      }

if (request.method === "POST") {
      const auth = request.headers.get("authorization") || "";
      const ok = checkBasic(auth, (env.EDITOR_USER || "").trim(), (env.EDITOR_PASS || "").trim());
      if (!ok) {
        return new Response("Unauthorized", { status: 401, headers: { ...cors, "WWW-Authenticate": 'Basic realm="notes"' }});
      }

        let body = {};
        try { body = await request.json(); } catch {}
        const current = JSON.parse(await env.NOTES_KV.get(key) || '{"notes":{}}');

        // Modalità 1: update singolo { id, content }
        if (body && typeof body.id === "string" && typeof body.content === "string") {
          current.notes[body.id] = body.content;
          await env.NOTES_KV.put(key, JSON.stringify(current));
          return new Response(JSON.stringify({ ok:true, mode:"single" }), { headers: { "Content-Type":"application/json", ...cors }});
        }

        // Modalità 2: replace intero { notes: {id: string, ...} }
        const n = body?.notes;
        if (!n || typeof n !== "object") {
          return new Response(JSON.stringify({ ok:false, error:"Formato non valido" }), { status: 400, headers: { "Content-Type":"application/json", ...cors }});
        }
        const bad = Object.values(n).some(v => typeof v !== "string");
        if (bad) {
          return new Response(JSON.stringify({ ok:false, error:"Tutti i valori devono essere stringhe" }), { status: 400, headers: { "Content-Type":"application/json", ...cors }});
        }
        await env.NOTES_KV.put(key, JSON.stringify({ notes: n }));
        return new Response(JSON.stringify({ ok:true, mode:"bulk" }), { headers: { "Content-Type":"application/json", ...cors }});
      }

      return new Response("Method not allowed", { status: 405 });
    }

    // static assets della cartella /public
    return env.ASSETS.fetch(request);
  }
};

function checkBasic(header, expectedUser, expectedPass) {
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6));
    const idx = decoded.indexOf(":");
    if (idx === -1) return false;
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1); // il resto, anche se contiene altri ':'
    return user === expectedUser && pass === expectedPass;
  } catch {
    return false;
  }
}
