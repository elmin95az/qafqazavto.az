/**
 * Qafqaz Avto — booking form → Telegram group proxy
 * ---------------------------------------------------
 * Runs on Cloudflare Workers. Keeps the bot token secret on the server
 * side (never in the site's HTML/JS) and forwards form submissions to
 * a Telegram group as a chat message.
 *
 * Required secrets/vars (set in the Cloudflare dashboard or via
 * `wrangler secret put <NAME>` — never hardcode them here):
 *   TELEGRAM_BOT_TOKEN  — the bot token from @BotFather
 *   TELEGRAM_CHAT_ID    — the target group's chat id (negative number,
 *                          e.g. -1001234567890 — see SETUP-TELEGRAM.md)
 *
 * Optional var:
 *   ALLOWED_ORIGIN — the site origin allowed to call this endpoint
 *                    (e.g. https://qafqazavto.az). Defaults to "*"
 *                    if not set, which is fine while testing locally.
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Basic honeypot / sanity checks
    const name = (data.name || "").toString().trim().slice(0, 200);
    const phone = (data.phone || "").toString().trim().slice(0, 60);
    const model = (data.model || "").toString().trim().slice(0, 200);
    const budget = (data.budget || "").toString().trim().slice(0, 60);
    const message = (data.message || "").toString().trim().slice(0, 1000);

    if (!name || !phone) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const escapeHtml = (s) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const lines = [
      "🚗 <b>Новая заявка с сайта</b>",
      "",
      `<b>Имя:</b> ${escapeHtml(name)}`,
      `<b>Телефон:</b> ${escapeHtml(phone)}`,
    ];
    if (model) lines.push(`<b>Марка/модель:</b> ${escapeHtml(model)}`);
    if (budget) lines.push(`<b>Бюджет:</b> ${escapeHtml(budget)} USD`);
    if (message) lines.push(`<b>Комментарий:</b> ${escapeHtml(message)}`);

    const text = lines.join("\n");

    const tgUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const tgResp = await fetch(tgUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!tgResp.ok) {
      const errText = await tgResp.text();
      return new Response(JSON.stringify({ ok: false, error: "Telegram error", details: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  },
};
