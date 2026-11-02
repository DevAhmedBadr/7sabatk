import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OWNER_ADMIN_ID = 'be398df3-3918-46e1-abc4-59975ffe716b';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders });

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anonKey || !serviceKey) {
      return json({ error: 'Server environment is not configured.' }, 500);
    }

    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // A role value alone never grants access: the authenticated caller must be the fixed owner.
    if (user.id !== OWNER_ADMIN_ID) {
      return json({ error: 'Only the store owner can manage customer accounts.' }, 403);
    }
    const { data: ownerProfile, error: ownerProfileError } = await caller
      .from('profiles').select('role,is_banned').eq('id', user.id).single();
    if (ownerProfileError || ownerProfile?.role !== 'admin' || ownerProfile?.is_banned) {
      return json({ error: 'Forbidden' }, 403);
    }

    const body = await req.json();
    const action = String(body?.action || '');
    const userId = String(body?.userId || '');
    if (!userId) return json({ error: 'userId is required' }, 400);

    // Never allow destructive or credential actions against the store owner's own account.
    if (userId === OWNER_ADMIN_ID) {
      return json({ error: 'The store owner account is protected from customer-management actions.' }, 400);
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (action === 'ban' || action === 'unban') {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        ban_duration: action === 'ban' ? '876000h' : 'none'
      });
      if (authUpdateError) throw authUpdateError;
      const { error: profileUpdateError } = await admin.from('profiles')
        .update({ is_banned: action === 'ban' }).eq('id', userId);
      if (profileUpdateError) throw profileUpdateError;
    } else if (action === 'set_role') {
      const role = String(body?.role || '');
      if (!['user', 'admin'].includes(role)) return json({ error: 'Invalid role' }, 400);
      const { error } = await admin.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
    } else if (action === 'update_email') {
      const email = String(body?.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'A valid email is required.' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true
      });
      if (error) throw error;
    } else if (action === 'update_password') {
      const password = String(body?.password || '');
      if (password.length < 8 || password.length > 72) {
        return json({ error: 'Password must be between 8 and 72 characters.' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    } else if (action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    } else {
      return json({ error: 'Unknown action' }, 400);
    }

    return json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return json({ error: message }, 400);
  }
});
