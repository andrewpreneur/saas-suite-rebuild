import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("saas_suite_users")
      .select("email, approval, email_warmup_access")
      .ilike("email", email)
      .maybeSingle();

    if (existingUser) {
      // User exists - just grant email warmup access, don't change their approval if they're already approved
      const updateFields: Record<string, unknown> = { email_warmup_access: true };
      
      // Only set approval to EMAIL_WARMUP if they don't already have a paid/active status
      const activeStatuses = ["YES", "TRIALING", "STARTER", "BASIC", "ADVANCED"];
      if (!activeStatuses.includes(existingUser.approval || "")) {
        updateFields.approval = "EMAIL_WARMUP";
      }

      const { error: updateError } = await supabase
        .from("saas_suite_users")
        .update(updateFields)
        .ilike("email", email);

      if (updateError) {
        console.error("Error updating user:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Email warmup access granted to existing user", email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // New user - create with EMAIL_WARMUP approval
    const { error: insertError } = await supabase
      .from("saas_suite_users")
      .insert({
        email: email.toLowerCase(),
        approval: "EMAIL_WARMUP",
        email_warmup_access: true,
        plan: "STARTER",
        initial_questions_completed: true, // Skip onboarding questions
        v2_navigation_enabled: true,
        client_hub_enabled: true,
      });

    if (insertError) {
      console.error("Error inserting user:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email warmup user created", email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
