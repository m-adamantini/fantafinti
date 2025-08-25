export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ✅ Accetta sia /api/notes che /api/notes/
    if (url.pathname === "/api/notes" || url.pathname === "/api/notes/") {
      const cors = {
        "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
        "Access-Control-Allow-Headers": "content-type, authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
      };
      if (request.method === "OPTIONS") return new Response(null, { headers: cors });

      const key = "notes-v2";

      if (request.method === "GET") {
        const json = await env.NOTES_KV.get(key);
        return new Response(json || JSON.stringify({ notes:{} }), { headers: { "Content-Type":"application/json", ...cors }});
      }

      if (request.method === "POST") {
        const auth = request.headers.get("authorization") || "";
        const ok = checkBasic(auth, (env.EDITOR_USER||"").trim(), (env.EDITOR_PASS||"").trim());
        if (!ok) return new Response("Unauthorized", { status: 401, headers: { ...cors, "WWW-Authenticate":'Basic realm="notes"' }});

        let body={}; try{ body=await request.json(); }catch{}
        const current = JSON.parse(await env.NOTES_KV.get(key) || '{"notes":{}}');

        if (typeof body.id === "string" && typeof body.content === "string") {
          current.notes[body.id] = body.content;
          await env.NOTES_KV.put(key, JSON.stringify(current));
          return new Response(JSON.stringify({ ok:true, mode:"single" }), { headers: { "Content-Type":"application/json", ...cors }});
        }

        if (!body.notes || typeof body.notes !== "object") {
          return new Response(JSON.stringify({ ok:false, error:"Formato non valido" }), { status:400, headers:{ "Content-Type":"application/json", ...cors }});
        }
        await env.NOTES_KV.put(key, JSON.stringify({ notes: body.notes }));
        return new Response(JSON.stringify({ ok:true, mode:"bulk" }), { headers: { "Content-Type":"application/json", ...cors }});
      }

      return new Response("Method not allowed", { status: 405, headers: cors });
    }

    // default: static assets
    return env.ASSETS.fetch(request);
  }
}

function checkBasic(header, expectedUser, expectedPass) {
  if (!header.startsWith("Basic ")) return false;
  try {
    const dec = atob(header.slice(6));
    const i = dec.indexOf(":");
    if (i === -1) return false;
    const u = dec.slice(0,i), p = dec.slice(i+1);
    return u === expectedUser && p === expectedPass;
  } catch { return false; }
}

