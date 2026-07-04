import { kvGet } from "../lib/kv.js";
import { signToken } from "../lib/token.js";

const DAY = 60 * 60 * 24;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  const email = String(req.query.email || "").trim().toLowerCase();
  if (!email) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "missing_email" }));
  }

  const allowed = await kvGet(`allow:${email}`);
  if (allowed) {
    const sessionToken = await signToken(
      { email, exp: Math.floor(Date.now() / 1000) + DAY * 90 },
      process.env.SESSION_SECRET
    );
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DAY * 90}`
    );
    return res.end(JSON.stringify({ status: "approved" }));
  }

  const reqRecord = await kvGet(`req:${email}`);
  const status = reqRecord ? reqRecord.status : "unknown";
  return res.end(JSON.stringify({ status }));
}
