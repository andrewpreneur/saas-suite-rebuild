// Slack OAuth callback: exchanges code -> tokens, stores per-workspace install.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET") ?? "";
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/slack-oauth`;
const SUCCESS_URL = "https://saassuite.ai/slack-integration?installed=1";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function htmlPage(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:-apple-system,system-ui,sans-serif;max-width:520px;margin:80px auto;padding:24px;color:#0f172a;text-align:center}
    h1{font-size:20px;margin:0 0 12px}p{color:#475569}a{color:#4f46e5}</style></head>
    <body><h1>${title}</h1>${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return htmlPage(
      "Slack install canceled",
      `<p>Slack returned: <code>${errorParam}</code></p><p><a href="${SUCCESS_URL}">Back to SaaSSuite</a></p>`,
      200,
    );
  }
  if (!code || !state) {
    return htmlPage("Missing code or state", `<p>Slack didn't send the expected parameters.</p>`, 400);
  }
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return htmlPage("Server not configured", `<p>SLACK_CLIENT_ID / SLACK_CLIENT_SECRET missing.</p>`, 500);
  }

  // Validate + burn state.
  const { data: stateRow, error: stateErr } = await supabase
    .from("slack_oauth_states")
    .select("id, agency_id, expires_at, used_at")
    .eq("state", state)
    .maybeSingle();
  if (stateErr || !stateRow) {
    return htmlPage("Invalid state", `<p>This install link isn't valid. Please start again from SaaSSuite.</p>`, 400);
  }
  if (stateRow.used_at) return htmlPage("Link already used", `<p>Start a fresh install from SaaSSuite.</p>`, 400);
  if (new Date(stateRow.expires_at).getTime() < Date.now()) {
    return htmlPage("Link expired", `<p>Start a fresh install from SaaSSuite.</p>`, 400);
  }
  await supabase.from("slack_oauth_states").update({ used_at: new Date().toISOString() }).eq("id", stateRow.id);

  // Exchange code -> tokens.
  const form = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: REDIRECT_URI,
  });
  const slackRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const slackJson = await slackRes.json().catch(() => ({} as any));
  if (!slackRes.ok || !slackJson?.ok) {
    console.error("oauth.v2.access failed:", slackRes.status, slackJson?.error);
    return htmlPage("Slack install failed", `<p>${slackJson?.error ?? "unknown error"}</p>`, 502);
  }

  const botToken: string = slackJson.access_token;
  const botUserId: string | null = slackJson.bot_user_id ?? null;
  const teamId: string | null = slackJson.team?.id ?? null;
  const teamName: string | null = slackJson.team?.name ?? null;
  const channelId: string | null = slackJson.incoming_webhook?.channel_id ?? null;
  const webhookUrl: string | null = slackJson.incoming_webhook?.url ?? null;

  if (!botToken || !teamId) {
    return htmlPage("Slack install incomplete", `<p>Missing bot token or team id in Slack response.</p>`, 502);
  }

  const { error: upsertErr } = await supabase
    .from("slack_channel_agency_map")
    .upsert(
      {
        agency_id: stateRow.agency_id,
        slack_team_id: teamId,
        slack_channel_id: channelId,
        bot_token: botToken,
        bot_user_id: botUserId,
        team_domain: teamName,
        label: teamName,
        webhook_url: webhookUrl,
        installed_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: "agency_id,slack_team_id" },
    );
  if (upsertErr) {
    const ref = crypto.randomUUID().slice(0, 8);
    console.error(`[slack-oauth ref=${ref}] install upsert failed`, {
      message: upsertErr.message,
      details: (upsertErr as any).details,
      hint: (upsertErr as any).hint,
      code: (upsertErr as any).code,
      agency_id: stateRow.agency_id,
      slack_team_id: teamId,
      slack_channel_id: channelId,
    });
    return htmlPage(
      "Save failed",
      `<p>Couldn't store your Slack install. Please contact support with reference <code>${ref}</code>.</p>
       <p style="color:#94a3b8;font-size:12px">${(upsertErr as any).code ?? ""} ${upsertErr.message ?? ""}</p>`,
      500,
    );
  }

  // Also mirror into slack_workspace_links so slash commands resolve immediately.
  await supabase.from("slack_workspace_links").upsert(
    {
      team_id: teamId,
      team_name: teamName,
      agency_id: stateRow.agency_id,
      agency_ids: [stateRow.agency_id],
      linked_by_email: (await supabase
        .from("slack_oauth_states").select("created_by_email").eq("id", stateRow.id).maybeSingle()).data?.created_by_email ?? "unknown@saassuite.ai",
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "team_id" },
  ).then(() => {}, () => {});

  // Post welcome message to the chosen channel.
  if (channelId) {
    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify({
          channel: channelId,
          text: "SaaSSuite connected!",
          blocks: [
            { type: "header", text: { type: "plain_text", text: "🎉 SaaSSuite is connected!", emoji: true } },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  `Your workspace *${teamName ?? teamId}* is now linked to agency \`${stateRow.agency_id}\`.\n\n` +
                  `*Commands you can run here:*\n` +
                  `• \`/support-status <email>\` — see a customer's support status\n` +
                  `• \`/user-info <email>\` — customer activity + engagement\n` +
                  `• \`/ticket-status <email>\` — recent tickets\n` +
                  `• \`/report\` — agency-wide summary\n` +
                  `• \`/copilot <question>\` — ask your AI CoPilot`,
              },
            },
          ],
        }),
      });
    } catch (e) {
      console.error("welcome message failed:", e);
    }
  }

  const successWithTeam = teamId ? `${SUCCESS_URL}&team_id=${encodeURIComponent(teamId)}` : SUCCESS_URL;
  return Response.redirect(successWithTeam, 302);
});