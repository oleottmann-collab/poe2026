# PoE Lernplattform - Deploy mit Freigabe-Modell (Request/Approve)

## Ablauf, wie es fuer alle Beteiligten aussieht

1. Ein Freund oeffnet die Website-URL. Ohne gueltiges Cookie landet er automatisch auf
   `/access.html` und traegt seine E-Mail-Adresse ein.
2. Ist diese E-Mail bereits von dir freigegeben (weil er schon mal drin war), wird er sofort
   durchgelassen, kein Warten.
3. Ist sie neu, bekommst DU eine Mail: "X moechte Zugang" mit zwei Links, Freigeben / Ablehnen.
4. Waehrenddessen wartet der Freund auf `/access.html` (Live-Check alle 4 Sekunden). Sobald du
   auf "Freigeben" klickst, wird er automatisch weitergeleitet, ohne dass er selbst noch etwas
   tun muss.
5. Einmal freigegebene E-Mail-Adressen bleiben dauerhaft freigegeben (auch auf neuen Geraeten,
   ohne erneute Anfrage) - bis du sie im Admin-Bereich wieder entziehst.
6. Unter `/api/admin` (mit deinem Master-Passwort) siehst du alle wartenden Anfragen und alle
   freigegebenen Adressen, kannst dort auch direkt jemanden hinzufuegen oder entziehen.

Kein geteilter Link mehr im Umlauf, keine Gefahr durch Weiterleiten. Es zaehlt ausschliesslich,
was du im Admin-Bereich bzw. per Mail-Klick freigibst.

## Was sich seit der letzten Version geaendert hat

- `api/verify.js` und `public/denied.html` (Einmallink-Modell) sind entfernt.
- Neu: `api/request.js`, `api/status.js`, `api/decide.js`, `public/access.html`, `lib/kv.js`,
  `lib/mail.js`. `api/admin.js` ist komplett neu (Listen + Freigeben/Ablehnen/Entziehen-Buttons).
- Braucht jetzt zusaetzlich zwei Dienste: einen kleinen Datenspeicher (Upstash Redis) und einen
  Mailversand (Resend), beide kostenlos fuer diese Groessenordnung.

## Setup, Schritt fuer Schritt

### 1. Dateien ins bestehende GitHub-Repo hochladen

Du hast das Repo und die HTML schon drin. Jetzt zusaetzlich hochladen (GitHub-Weboberflaeche,
"Add file" -> "Upload files"), und zwar die komplette Struktur aus diesem `Deploy_Scaffold`-Ordner:
`middleware.js`, `vercel.json`, `package.json`, `.gitignore`, sowie die Ordner `api/`, `lib/`,
`public/` (inkl. `public/access.html`; `public/index.html` hast du ja schon, das kann so bleiben
oder durch diese Kopie ersetzt werden, Inhalt ist identisch zum aktuellen Stand vom 2026-07-04).

### 2. Upstash Redis in Vercel hinzufuegen

Im Vercel-Projekt: Tab "Storage" -> "Create Database" bzw. "Marketplace Database" -> "Upstash for
Redis" (oder aehnlich benannt, Vercel hat den genauen Namen/Ablauf in der Vergangenheit schon mal
umbenannt) -> mit dem Projekt verbinden. Das setzt automatisch Umgebungsvariablen. **Wichtig, bitte
kurz pruefen und mir sagen, wie sie genau heissen** (voraussichtlich `KV_REST_API_URL` /
`KV_REST_API_TOKEN` oder `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`). Der Code in
`lib/kv.js` unterstuetzt beide Varianten, aber falls es doch anders heisst, sag mir die exakten
Namen aus der Vercel-Env-Var-Liste, dann passe ich es an.

### 3. Resend fuer Mailversand einrichten

- Auf resend.com kostenlos registrieren, und zwar mit deiner eigenen Adresse
  (ole.ottmann@t-online.de), weil Mails im kostenlosen Modus ohne eigene Domain nur an genau diese
  Adresse gehen duerfen. Das reicht hier, weil ausschliesslich du benachrichtigt wirst.
- API-Key erzeugen (Dashboard -> API Keys -> Create).

### 4. Environment Variables in Vercel setzen

Unter Project Settings -> Environment Variables:

| Name | Wert |
|---|---|
| `SESSION_SECRET` | `2VTmIt3wv66hCdkGr8sh1WsBku8Gf8822/hjsR+bYmQ=` |
| `ADMIN_PASSWORD` | dein selbst gewaehltes Master-Passwort |
| `RESEND_API_KEY` | der Key aus Schritt 3 |
| `OWNER_EMAIL` | ole.ottmann@t-online.de |
| `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` | von Schritt 2, je nachdem wie benannt |
| `KV_REST_API_TOKEN` / `UPSTASH_REDIS_REST_TOKEN` | von Schritt 2, je nachdem wie benannt |

### 5. Deployen

Jetzt erst deployen (Vercel macht das automatisch nach dem naechsten Push, oder manuell im
Dashboard "Redeploy").

### 6. Testen

1. Website-URL oeffnen (normaler Browser, kein Cookie) -> sollte auf `/access.html` umleiten.
2. Eigene E-Mail eintragen -> "Warte auf Freigabe" sollte erscheinen.
3. Innerhalb weniger Sekunden sollte eine Mail bei dir ankommen (ole.ottmann@t-online.de) mit
   Freigeben/Ablehnen-Links.
4. Auf "Freigeben" klicken -> das Browserfenster von Schritt 2 sollte sich innerhalb von
   ca. 4 Sekunden automatisch auf die Lernplattform umleiten.
5. Seite neu laden -> sollte weiterhin funktionieren (Cookie sitzt).
6. `/api/admin` mit deinem Master-Passwort oeffnen -> deine Test-Mail sollte unter "Freigegeben"
   auftauchen, mit "Entziehen"-Button.

### 7. Freunde einladen

Nichts weiter noetig als ihnen die Website-URL zu schicken. Sie tragen ihre E-Mail selbst ein,
du bekommst die Anfrage automatisch und klickst freigeben.

### 8. Content-Updates (ab naechster Woche)

Wie gewohnt: `public/index.html` im GitHub-Repo ersetzen, Vercel deployt automatisch neu. Der
Zugriffsschutz ist komplett unabhaengig davon.

## Offene Annahmen, vor dem ersten echten Test zu pruefen

- **Upstash-REST-API-Format** (`lib/kv.js`): Ich nutze den `/pipeline`-Endpoint, wie er in der
  Upstash-Dokumentation zum Zeitpunkt meines Wissensstands beschrieben ist. Nicht live getestet.
- **Resend ohne Domain**: Versand an die eigene Account-Mailadresse sollte im Sandbox-Modus ohne
  Domain-Verifizierung funktionieren. Ebenfalls nicht live getestet.
- **Vercel Edge Middleware auf "Other"-Projekten**: wie in der Vorversion, gleiche Einschraenkung.

Falls beim Testen (Schritt 6) irgendwo eine Fehlermeldung auftaucht (im Vercel-Dashboard unter
"Functions" bzw. "Logs" einsehbar), schick mir die genaue Meldung, dann korrigieren wir gezielt
statt zu raten.
