/* Run this ONCE, locally, after creating a Xero "Web app" (free — not a
   Custom Connection) at developer.xero.com/app/manage. It does the one login
   a Web app needs and prints everything sync_xero.js needs going forward.

   Usage:
     XERO_CLIENT_ID=xxx XERO_CLIENT_SECRET=xxx node scripts/xero_oauth_bootstrap.js

   What it does:
     1. Starts a tiny local server on http://localhost:5000/callback — this
        must exactly match the "OAuth 2.0 redirect URI" set on the app.
     2. Opens your browser to Xero's login/consent screen.
     3. You log in and click Allow, once.
     4. Xero redirects back to localhost with a one-time code; this exchanges
        it for an access token + refresh token, then calls Xero's
        /connections endpoint to find which org (tenant) you just connected.
     5. Prints the refresh token and tenant id — paste those into the repo's
        GitHub secrets (Settings -> Secrets and variables -> Actions) as
        XERO_REFRESH_TOKEN and XERO_TENANT_ID. sync_xero.js takes it from
        there, rotating XERO_REFRESH_TOKEN itself on every scheduled run
        (see its own comment for how).

   The refresh token this prints is live and unused — do not paste it
   anywhere but the GitHub secret. Whoever holds it can read this Xero org's
   accounting data until it is revoked (Xero Developer portal -> Connection
   management) or rotated by the next successful sync.
*/
"use strict";

const http = require("http");
const { execFile } = require("child_process");

const PORT = 5000;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = "offline_access accounting.transactions.read accounting.contacts.read accounting.settings.read";

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open"
            : process.platform === "win32"  ? "start"
            : "xdg-open";
  execFile(cmd, [url], () => {}); // best-effort; the URL is printed either way
}

async function main() {
  const clientId = need("XERO_CLIENT_ID");
  const clientSecret = need("XERO_CLIENT_SECRET");
  const state = Math.random().toString(36).slice(2);

  const authorizeUrl = new URL("https://login.xero.com/identity/connect/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("scope", SCOPES);
  authorizeUrl.searchParams.set("state", state);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== "/callback") { res.writeHead(404); res.end(); return; }

      const err = url.searchParams.get("error");
      if (err) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<p>Xero returned an error: ${err}. Check the terminal and try again.</p>`);
        server.close();
        reject(new Error(`Xero authorize error: ${err}`));
        return;
      }
      if (url.searchParams.get("state") !== state) {
        res.writeHead(400); res.end("State mismatch — try again.");
        return; // don't close/reject; could be a stray request
      }
      const c = url.searchParams.get("code");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<p>Connected. You can close this tab and go back to the terminal.</p>");
      server.close();
      resolve(c);
    });
    server.listen(PORT, () => {
      console.log("Opening your browser to log into Xero...");
      console.log("If it doesn't open, paste this URL into a browser:\n");
      console.log(authorizeUrl.toString() + "\n");
      openBrowser(authorizeUrl.toString());
    });
  });

  console.log("\nGot the code, exchanging it for tokens...");
  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI
    })
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed ${tokenRes.status}: ${await tokenRes.text()}`);
  const tokens = await tokenRes.json();

  const connRes = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  if (!connRes.ok) throw new Error(`/connections failed ${connRes.status}: ${await connRes.text()}`);
  const connections = await connRes.json();

  console.log("\n== Connected organisation(s) ==");
  connections.forEach(c => console.log(`  ${c.tenantName}  ->  tenantId: ${c.tenantId}`));
  if (connections.length !== 1) {
    console.log("\nMore than one org authorised — pick the SDL one's tenantId above.");
  }

  console.log("\n== Paste these into the repo's GitHub secrets ==");
  console.log("(Settings -> Secrets and variables -> Actions -> New repository secret)\n");
  console.log("XERO_CLIENT_ID       =", clientId);
  console.log("XERO_CLIENT_SECRET   =", clientSecret);
  console.log("XERO_REFRESH_TOKEN   =", tokens.refresh_token);
  console.log("XERO_TENANT_ID       =", connections[0] ? connections[0].tenantId : "(see list above)");
  console.log("\nsync_xero.js rotates XERO_REFRESH_TOKEN itself after every successful run");
  console.log("(needs GH_SECRETS_PAT too — see the README's Business metrics section for");
  console.log("how to create that PAT). This bootstrap script is not needed again unless");
  console.log("the connection is revoked or the refresh token expires from 60 days of");
  console.log("the scheduled sync not running.");
}

main().catch(e => { console.error("\n" + e.message); process.exit(1); });
