import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { ghlEmailClaims } from "../_shared/ghl-email-claim.ts";
import { ghlEmailDedupeKey, postGhlEmailEvent } from "../_shared/ghl-email-webhook.ts";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_ORIGIN = "https://saassuite.ai";

interface InviteAdminRequest {
  admin_email: string;
  admin_name?: string;
  admin_phone?: string;
  owner_email?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user?.email) return json({ error: "Unauthorized" }, 401);
    const callerEmail = user.email.trim().toLowerCase();

    const body: InviteAdminRequest = await req.json();
    const adminEmail = String(body.admin_email || "").trim().toLowerCase();
    if (!adminEmail) return json({ error: "Admin email is required" }, 400);

    // The account being administered is the one on screen (which may be a
    // switched/impersonated account), not necessarily the caller's own login.
    const ownerEmail = String(body.owner_email || callerEmail).trim().toLowerCase();
    if (ownerEmail !== callerEmail && !isPlatformAdminEmail(callerEmail)) {
      return json({ error: "Only the account owner can add admins" }, 403);
    }
    if (adminEmail === ownerEmail) {
      return json({ error: "The account owner can't be added as their own admin" }, 400);
    }

    const { data: ownerData } = await supabase
      .from("saas_suite_users")
      .select("full_name, agency_name")
      .ilike("email", ownerEmail)
      .maybeSingle();
    if (!ownerData) return json({ error: "Account not found" }, 404);

    const agencyName = ownerData.agency_name || ownerData.full_name || ownerEmail;
    const ownerName = ownerData.full_name || agencyName;

    const { data: adminRecord, error: insertError } = await supabase
      .from("account_admins")
      .insert({
        owner_email: ownerEmail,
        admin_email: adminEmail,
        admin_name: body.admin_name || null,
        admin_phone: body.admin_phone ? String(body.admin_phone).trim().slice(0, 40) || null : null,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      if (insertError.code === "23505") return json({ error: "This user has already been invited as an admin" }, 400);
      return json({ error: "Failed to create admin invitation" }, 500);
    }

    // Build one sign-in link ourselves (no Supabase template email). GoHighLevel
    // delivers that link. The account on screen stays the owner.
    const redirectTo = `${APP_ORIGIN}/account-selector?account=${encodeURIComponent(ownerEmail)}`;
    const meta = { admin_name: body.admin_name || null, invited_by: ownerName, role: "account_admin" };
    let actionLink: string | null = null;
    let isNewUser = true;
    {
      const { data, error } = await supabase.auth.admin.generateLink({
        type: "invite", email: adminEmail, options: { redirectTo, data: meta },
      });
      if (!error) actionLink = data?.properties?.action_link ?? null;
      else {
        isNewUser = false;
        const { data: ml, error: mlErr } = await supabase.auth.admin.generateLink({
          type: "magiclink", email: adminEmail, options: { redirectTo },
        });
        if (mlErr) console.error("generateLink error:", mlErr);
        actionLink = ml?.properties?.action_link ?? null;
      }
    }

    let emailSent = false;
    const subject = `You've been added as an admin on ${agencyName}`;
    if (!actionLink) {
      await logCustomerMessage({
        userEmail: adminEmail,
        channel: "email",
        templateKey: "admin_invite",
        subject,
        provider: "ghl",
        status: "failed",
        source: "invite-account-admin",
        detail: "missing_action_link",
      });
    } else {
      const emailed = await postGhlEmailEvent("admin_invite", {
        email: adminEmail,
        full_name: body.admin_name || "",
        invite_url: actionLink,
        inviter_name: ownerName,
        agency_name: agencyName,
        subject,
        is_new_user: isNewUser ? "yes" : "no",
      }, {
        source: "invite-account-admin",
        dedupeKey: ghlEmailDedupeKey("admin_invite", String(adminRecord.id ?? "")),
        claims: ghlEmailClaims(supabase),
      });
      emailSent = emailed.status === "sent" || emailed.status === "duplicate";
    }

    return json({ success: true, email_sent: emailSent, message: "Admin invitation sent", admin: adminRecord });
  } catch (error: any) {
    console.error("Error in invite-account-admin function:", error);
    return json({ error: error.message || "Internal server error" }, 500);
  }
};

serve(handler);
