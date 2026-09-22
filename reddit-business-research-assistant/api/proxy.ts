// Server-side proxy to the shared dashboard proxy. Keeps DASHBOARD_PROXY_SECRET
// off the client bundle. The frontend (services/geminiService.ts) calls this
// app's own /api/proxy route instead of calling Gemini directly.
//
// Set DASHBOARD_PROXY_URL and DASHBOARD_PROXY_SECRET in the deployment's
// environment variables (Vercel: Project → Settings → Environment Variables —
// NOT prefixed with VITE_). Locally they come from .env.local via the dev
// middleware in vite.config.ts.

export const config = { runtime: "edge" };

const PROXY_APP_SLUG = "bunnys-marketingmind-ai";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const proxyUrl = process.env.DASHBOARD_PROXY_URL;
  const proxySecret = process.env.DASHBOARD_PROXY_SECRET;
  if (!proxyUrl || !proxySecret) {
    return json(
      {
        error:
          "DASHBOARD_PROXY_URL / DASHBOARD_PROXY_SECRET is not configured on the server. Add them to your deployment's environment variables and redeploy.",
      },
      500,
    );
  }

  const body = await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(`${proxyUrl}/api/proxy/${PROXY_APP_SLUG}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-proxy-secret": proxySecret,
      },
      body,
    });
  } catch (e) {
    return json({ error: `Could not reach the dashboard proxy: ${String(e)}` }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}
