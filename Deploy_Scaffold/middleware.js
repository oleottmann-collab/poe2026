import { verifyToken } from "./lib/token.js";

// Laeuft auf jeder Anfrage, AUSSER den in config.matcher ausgeschlossenen Pfaden.
// Prueft das Session-Cookie. Ohne gueltiges Cookie -> Redirect auf /access.html
// (dort kann ein neuer Zugang beantragt werden).
export default async function middleware(req) {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  const token = match ? match[1] : null;

  if (token) {
    const payload = await verifyToken(token, process.env.SESSION_SECRET);
    if (payload && payload.email) {
      return; // durchlassen
    }
  }

  const url = new URL(req.url);
  url.pathname = "/access.html";
  return Response.redirect(url, 302);
}

export const config = {
  matcher: [
    // Alles ausser: /api/*, /access.html, favicon, statische Vercel-Assets
    "/((?!api/|access\\.html|favicon\\.ico|_vercel).*)",
  ],
};
