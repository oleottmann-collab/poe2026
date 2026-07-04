// Duenner Client fuer Upstash Redis ueber die REST-Pipeline-API.
// Funktioniert sowohl mit den env-var-Namen von "Upstash for Redis" (Vercel Marketplace
// Integration) als auch mit den aelteren "Vercel KV"-Namen, je nachdem was Vercel injiziert.
// ANNAHME (nicht live getestet): Pipeline-Endpoint-Format entspricht der Upstash-REST-API-Doku
// Stand meines Kenntnisstands. Falls beim ersten echten Aufruf ein Fehler kommt, bitte die
// genaue Fehlermeldung schicken, dann passen wir das an die tatsaechliche Antwort an.

function getConfig() {
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Kein KV_REST_API_URL/TOKEN bzw. UPSTASH_REDIS_REST_URL/TOKEN gesetzt. " +
        "Upstash-Redis-Integration in Vercel unter Storage hinzufuegen."
    );
  }
  return { url, token };
}

async function pipeline(commands) {
  const { url, token } = getConfig();
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash pipeline error ${res.status}: ${text}`);
  }
  return res.json(); // Array von { result } oder { error }
}

async function kvGet(key) {
  const [r] = await pipeline([["GET", key]]);
  if (!r || r.result == null) return null;
  try {
    return JSON.parse(r.result);
  } catch {
    return r.result;
  }
}

async function kvSet(key, value, ttlSeconds) {
  const val = typeof value === "string" ? value : JSON.stringify(value);
  const cmd = ttlSeconds ? ["SET", key, val, "EX", String(ttlSeconds)] : ["SET", key, val];
  await pipeline([cmd]);
}

async function kvDel(key) {
  await pipeline([["DEL", key]]);
}

async function sadd(setKey, member) {
  await pipeline([["SADD", setKey, member]]);
}

async function srem(setKey, member) {
  await pipeline([["SREM", setKey, member]]);
}

async function smembers(setKey) {
  const [r] = await pipeline([["SMEMBERS", setKey]]);
  return (r && r.result) || [];
}

export { kvGet, kvSet, kvDel, sadd, srem, smembers };
