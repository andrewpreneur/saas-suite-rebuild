import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { validateDeletionConfirmation } from './policy.ts';

const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST to delete your account.' });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !serviceKey || !anonKey) return reply(503, { error: 'Account deletion is temporarily unavailable.' });
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Please sign in again.' });
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user?.email) return reply(401, { error: 'Please sign in again.' });
    let body: unknown;
    try { body = await req.json(); } catch { return reply(400, { error: 'Confirm your account deletion first.' }); }
    if (!validateDeletionConfirmation(body, user.email)) return reply(400, { error: 'Type DELETE and confirm your own account email.' });
    const admin = createClient(url, serviceKey);
    const { error: cleanupError } = await admin.rpc('cleanup_account_for_deletion', { p_user_id: user.id });
    if (cleanupError) {
      console.error('Account cleanup failed:', cleanupError.code);
      return reply(500, { error: 'We could not finish account cleanup. Your sign-in has not been deleted. Please contact support or try again.' });
    }
    const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
    if (deletionError) {
      console.error('Auth deletion failed:', deletionError.status);
      return reply(500, { error: 'Your settings were removed, but sign-in deletion could not finish. Please retry or contact support.' });
    }
    return reply(200, { success: true });
  } catch {
    return reply(500, { error: 'Account deletion failed. Please try again or contact support.' });
  }
});