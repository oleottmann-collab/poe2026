import { verifyToken } from "../lib/token.js";
import { kvSet, sadd, srem } from "../lib/kv.js";

function page(message) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8" /><title>Zugang</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center;}</style>
</head><body><p>${message}</p></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  const token = req.query.token;
  if (!token) {
    res.statusCode = 400;
    return res.end(page("Kein Token angegeben."));
  }

  const payload = await verifyToken(String(token), process.env.SESSION_SECRET);
  if (!payload || !payload.email || !payload.action) {
    res.statusCode = 400;
    return res.end(page("Link ungueltig oder abgelaufen. Im Admin-Bereich (/api/admin) kannst du die Anfrage trotzdem manuell bearbeiten."));
  }

  const { email, action } = payload;

  if (action === "approve") {
    await kvSet(`allow:${email}`, "1"); // dauerhaft, kein TTL
    await kvSet(`req:${email}`, { status: "approved", createdAt: Date.now() });
    await sadd("idx:allowed", email);
    await srem("idx:pending", email);
    return res.end(page(`${email} wurde freigegeben. Die Person wird auf ihrem Bildschirm automatisch reingelassen.`));
  }

  if (action === "deny") {
    await kvSet(`req:${email}`, { status: "denied", createdAt: Date.now() });
    await srem("idx:pending", email);
    return res.end(page(`${email} wurde abgelehnt.`));
  }

  res.statusCode = 400;
  return res.end(page("Unbekannte Aktion."));
}
