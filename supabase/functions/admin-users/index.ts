import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const OWNER_ADMIN_ID = 'be398df3-3918-46e1-abc4-59975ffe716b';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);
    if (user.id !== OWNER_ADMIN_ID) return json({ error: 'Only the store owner can manage customer accounts.' }, 403);
    const { data: profile } = await caller.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return json({ error: 'Forbidden' }, 403);
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const body = await req.json();
    const { action, userId } = body;
    if (!userId || typeof userId !== 'string') return json({ error: 'userId is required' }, 400);
    if (userId === user.id && ['delete', 'ban', 'set_role'].includes(action)) return json({ error: 'You cannot apply this action to your own admin account.' }, 400);
    if (action === 'ban' || action === 'unban') {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: action === 'ban' ? '876000h' : 'none' });
      if (error) throw error;
      const { error: pError } = await admin.from('profiles').update({ is_banned: action === 'ban' }).eq('id', userId);
      if (pError) throw pError;
    } else if (action === 'set_role') {
      if (!['user', 'admin'].includes(body.role)) return json({ error: 'Invalid role' }, 400);
      const { error } = await admin.from('profiles').update({ role: body.role }).eq('id', userId);
      if (error) throw error;
    } else if (action === 'update_email') {
      const email = String(body.email || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
      if (error) throw error;
      const { error: pError } = await admin.from('profiles').update({ email }).eq('id', userId);
      if (pError) throw pError;
    } else if (action === 'update_password') {
      const password = String(body.password || '');
      if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
    } else if (action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    } else return json({ error: 'Unknown action' }, 400);
    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
});
