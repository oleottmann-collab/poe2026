// Schickt eine Mail an DICH (Ole) ueber Resend, wenn jemand Zugang beantragt.
// Braucht keine eigene Domain, weil Resends Test-Absender "onboarding@resend.dev"
// im kostenlosen Modus an die eigene, bei Resend registrierte Adresse senden darf.
// ANNAHME: dieses Verhalten von Resend war zum Zeitpunkt meines Wissensstands so dokumentiert,
// nicht in dieser Session live getestet. Falls der Versand fehlschlaegt, bitte die Fehlermeldung
// aus dem Vercel-Funktionslog schicken.

async function sendOwnerNotification({ toEmail, requesterEmail, approveUrl, denyUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY fehlt.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PoE Lernplattform <onboarding@resend.dev>",
      to: [toEmail],
      subject: `Zugangsanfrage: ${requesterEmail}`,
      html: `
        <p><strong>${escapeHtml(requesterEmail)}</strong> moechte Zugang zur PoE Lernplattform.</p>
        <p>
          <a href="${approveUrl}" style="color:green;font-weight:bold;">Freigeben</a>
          &nbsp;|&nbsp;
          <a href="${denyUrl}" style="color:#a00;">Ablehnen</a>
        </p>
      `,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export { sendOwnerNotification };
