import { kvGet, kvSet, sadd } from "../lib/kv.js";
import { signToken } from "../lib/token.js";
import { sendOwnerNotification } from "../lib/mail.js";

const DAY = 60 * 60 * 24;
const DECISION_LINK_LIFETIME = DAY * 14; // Freigabe/Ablehnen-Link im Mail-Postfach
const MAIL_COOLDOWN_SECONDS = 60 * 5; // verhindert Mail-Spam bei Mehrfach-Submit

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }

  const email = (req.body || {}).email;
  if (!isValidEmail(email)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "invalid_email" }));
  }

  const normalized = email.trim().toLowerCase();

  // Schon dauerhaft freigegeben? Dann direkt Session-Cookie setzen, kein Warten noetig.
  const alreadyAllowed = await kvGet(`allow:${normalized}`);
  if (alreadyAllowed) {
    const sessionToken = await signToken(
      { email: normalized, exp: Math.floor(Date.now() / 1000) + DAY * 90 },
      process.env.SESSION_SECRET
    );
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DAY * 90}`
    );
    return res.end(JSON.stringify({ status: "approved" }));
  }

  // Noch nicht freigegeben -> Anfrage anlegen (bzw. bestehende zurueckgeben).
  const existing = await kvGet(`req:${normalized}`);
  if (!existing || existing.status === "denied") {
    await kvSet(`req:${normalized}`, { status: "pending", createdAt: Date.now() }, DAY * 30);
    await sadd("idx:pending", normalized);
  }

  // Mail an dich nur, wenn nicht gerade erst eine raus ist (Cooldown gegen Doppel-Submit).
  const cooldownKey = `mailsent:${normalized}`;
  const alreadySent = await kvGet(cooldownKey);
  if (!alreadySent) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const base = `${proto}://${host}`;

    const approveToken = await signToken(
      { email: normalized, action: "approve", exp: Math.floor(Date.now() / 1000) + DECISION_LINK_LIFETIME },
      process.env.SESSION_SECRET
    );
    const denyToken = await signToken(
      { email: normalized, action: "deny", exp: Math.floor(Date.now() / 1000) + DECISION_LINK_LIFETIME },
      process.env.SESSION_SECRET
    );

    try {
      await sendOwnerNotification({
        toEmail: process.env.OWNER_EMAIL,
        requesterEmail: normalized,
        approveUrl: `${base}/api/decide?token=${encodeURIComponent(approveToken)}`,
        denyUrl: `${base}/api/decide?token=${encodeURIComponent(denyToken)}`,
      });
      await kvSet(cooldownKey, "1", MAIL_COOLDOWN_SECONDS);
    } catch (err) {
      // Anfrage bleibt trotzdem gespeichert, damit du sie im Admin-Bereich manuell freigeben kannst,
      // auch wenn der Mailversand geklappt hat oder nicht.
      console.error("sendOwnerNotification failed", err);
    }
  }

  return res.end(JSON.stringify({ status: "pending" }));
}
