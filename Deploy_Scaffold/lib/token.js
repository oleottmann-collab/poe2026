// Gemeinsame Signatur-Logik fuer Login-Links und Session-Cookies.
// Nutzt Web Crypto (SubtleCrypto), damit dieselbe Datei sowohl in
// Vercel Edge Middleware als auch in normalen Serverless Functions (Node) laeuft.

function base64url(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    "="
  );
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// payload: beliebiges JSON-faehiges Objekt, MUSS ein "exp" Feld (Unix-Sekunden) enthalten.
async function signToken(payload, secret) {
  const enc = new TextEncoder();
  const payloadBytes = enc.encode(JSON.stringify(payload));
  const payloadB64 = base64url(payloadBytes);
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const sigB64 = base64url(new Uint8Array(sig));
  return `${payloadB64}.${sigB64}`;
}

// Gibt das Payload-Objekt zurueck, wenn Signatur gueltig UND nicht abgelaufen ist.
// Sonst null (nie werfen, damit Middleware nicht abstuerzt).
async function verifyToken(token, secret) {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;
    const enc = new TextEncoder();
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(sigB64),
      enc.encode(payloadB64)
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (typeof payload.exp !== "number" || Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export { signToken, verifyToken };
