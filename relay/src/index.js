// TC Poker Export relay. Holds an encrypted hand-export blob for a short window
// so the userscript on torn.com can hand it to the app on poker.systoned.cc
// without the clipboard (fails on mobile) or window.open + postMessage (torn.com
// sends Cross-Origin-Opener-Policy: same-origin, which nulls window.opener in a
// cross-origin popup). The server only ever sees AES-GCM ciphertext: the key
// travels in the app URL fragment, never to this Worker. Objects are deleted on
// read and expire after 10 minutes regardless.
const PUT_ORIGIN = "https://www.torn.com";
const GET_ORIGIN = "https://poker.systoned.cc";
const MAX_BYTES = 40 * 1024 * 1024; // 40 MB
const TTL_SECONDS = 600; // 10 minutes
const ID_RE = /^[A-Za-z0-9_-]{22}$/;

function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const PUT_CORS = {
  "Access-Control-Allow-Origin": PUT_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const GET_CORS = {
  "Access-Control-Allow-Origin": GET_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function handlePut(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: PUT_CORS });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: PUT_CORS });

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("Payload too large", { status: 413, headers: PUT_CORS });

  const idBytes = new Uint8Array(16);
  crypto.getRandomValues(idBytes);
  const id = b64url(idBytes);
  await env.RELAY.put(id, body, { expirationTtl: TTL_SECONDS });
  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { ...PUT_CORS, "Content-Type": "application/json" },
  });
}

async function handleGet(request, env, id) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: GET_CORS });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: GET_CORS });
  if (!ID_RE.test(id)) return new Response("Bad id", { status: 400, headers: GET_CORS });

  const value = await env.RELAY.get(id, "arrayBuffer");
  if (value === null) return new Response("Not found", { status: 404, headers: GET_CORS });
  await env.RELAY.delete(id);
  return new Response(value, {
    status: 200,
    headers: { ...GET_CORS, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/put") return handlePut(request, env);
    if (path.startsWith("/get/")) return handleGet(request, env, path.slice(5));
    return new Response("Not found", { status: 404 });
  },
};
