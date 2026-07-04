import { kvSet, kvDel, sadd, srem, smembers } from "../lib/kv.js";

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function page({ pw = "", allowed = [], pending = [], message = "" } = {}) {
  const rowsAllowed = allowed
    .map(
      (e) => `<tr><td>${escapeHtml(e)}</td><td>
        <form method="POST" action="/api/admin" style="display:inline">
          <input type="hidden" name="password" value="${escapeHtml(pw)}" />
          <input type="hidden" name="action" value="revoke" />
          <input type="hidden" name="email" value="${escapeHtml(e)}" />
          <button type="submit">Entziehen</button>
        </form>
      </td></tr>`
    )
    .join("");

  const rowsPending = pending
    .map(
      (e) => `<tr><td>${escapeHtml(e)}</td><td>
        <form method="POST" action="/api/admin" style="display:inline">
          <input type="hidden" name="password" value="${escapeHtml(pw)}" />
          <input type="hidden" name="action" value="approve" />
          <input type="hidden" name="email" value="${escapeHtml(e)}" />
          <button type="submit">Freigeben</button>
        </form>
        <form method="POST" action="/api/admin" style="display:inline">
          <input type="hidden" name="password" value="${escapeHtml(pw)}" />
          <input type="hidden" name="action" value="deny" />
          <input type="hidden" name="email" value="${escapeHtml(e)}" />
          <button type="submit">Ablehnen</button>
        </form>
      </td></tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>PoE Lernplattform - Zugang verwalten</title>
<meta name="robots" content="noindex, nofollow" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: system-ui, sans-serif; max-width: 680px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 1.3rem; }
  h2 { font-size: 1.05rem; margin-top: 32px; }
  label { display: block; margin-top: 16px; font-size: 0.9rem; }
  input[type=password], input[type=email] { width: 100%; padding: 8px; margin-top: 4px; box-sizing: border-box; font-size: 1rem; }
  button { padding: 6px 12px; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  td { padding: 6px 4px; border-bottom: 1px solid #eee; font-size: 0.9rem; }
  .msg { margin-top: 16px; padding: 10px 14px; background: #f0f4f0; border: 1px solid #ccc; }
</style>
</head>
<body>
  <h1>Zugang verwalten</h1>

  ${!pw ? `
  <form method="POST" action="/api/admin">
    <input type="hidden" name="action" value="unlock" />
    <label>Master-Passwort
      <input type="password" name="password" required autofocus />
    </label>
    <button type="submit" style="margin-top:16px;">Anzeigen</button>
  </form>
  ` : `
  ${message ? `<div class="msg">${message}</div>` : ""}

  <h2>Wartende Anfragen (${pending.length})</h2>
  ${pending.length ? `<table>${rowsPending}</table>` : "<p>Keine.</p>"}

  <h2>Freigegeben (${allowed.length})</h2>
  ${allowed.length ? `<table>${rowsAllowed}</table>` : "<p>Noch niemand.</p>"}

  <h2>Manuell freigeben</h2>
  <form method="POST" action="/api/admin">
    <input type="hidden" name="password" value="${escapeHtml(pw)}" />
    <input type="hidden" name="action" value="add" />
    <label>E-Mail-Adresse
      <input type="email" name="email" required />
    </label>
    <button type="submit" style="margin-top:16px;">Direkt freigeben</button>
  </form>
  `}
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  if (req.method === "GET") {
    return res.end(page());
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  const { password, action, email } = req.body || {};

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    res.statusCode = 401;
    return res.end(page({ message: "Falsches Master-Passwort." }));
  }

  const normalized = (email || "").trim().toLowerCase();

  try {
    if (action === "add" && normalized) {
      await kvSet(`allow:${normalized}`, "1");
      await sadd("idx:allowed", normalized);
      await srem("idx:pending", normalized);
    } else if (action === "approve" && normalized) {
      await kvSet(`allow:${normalized}`, "1");
      await sadd("idx:allowed", normalized);
      await srem("idx:pending", normalized);
    } else if (action === "deny" && normalized) {
      await srem("idx:pending", normalized);
      await kvSet(`req:${normalized}`, { status: "denied", createdAt: Date.now() });
    } else if (action === "revoke" && normalized) {
      await kvDel(`allow:${normalized}`);
      await srem("idx:allowed", normalized);
    }
  } catch (err) {
    console.error("admin action failed", err);
    res.statusCode = 500;
    return res.end(page({ pw: password, message: "Fehler: " + escapeHtml(err.message) }));
  }

  const [allowed, pending] = await Promise.all([smembers("idx:allowed"), smembers("idx:pending")]);
  const message = action === "unlock" ? "" : "Aktualisiert.";
  return res.end(page({ pw: password, allowed, pending, message }));
}
