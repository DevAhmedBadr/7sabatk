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
    if (!url || !anonKey || !serviceKey) return json({ error: 'Server environment is not configured.' }, 500);

    const authorization = req.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Only the fixed, active site owner may use this privileged endpoint.
    if (user.id !== OWNER_ADMIN_ID) return json({ error: 'Only the store owner can manage accounts and support agents.' }, 403);
    const { data: ownerProfile, error: ownerError } = await caller
      .from('profiles').select('role,is_banned').eq('id', user.id).single();
    if (ownerError || ownerProfile?.role !== 'admin' || ownerProfile?.is_banned) return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const action = String(body?.action || '');
    const userId = String(body?.userId || '');
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    if (action === 'list_users' || action === 'list_support_agents') {
      const authUsers = [];
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        authUsers.push(...(data.users || []));
        if ((data.users || []).length < 1000) break;
      }
      const ids = authUsers.map((entry) => entry.id);
      const profilesById = new Map<string, Record<string, unknown>>();
      const agentsById = new Map<string, Record<string, unknown>>();
      for (let start = 0; start < ids.length; start += 500) {
        const batch = ids.slice(start, start + 500);
        const { data: profiles, error: profilesError } = await admin.from('profiles')
          .select('id,full_name,username,role,is_banned').in('id', batch);
        if (profilesError) throw profilesError;
        for (const profile of profiles || []) profilesById.set(profile.id, profile);
        // Keep the existing users page independent from the optional support-agent schema.
        if (action === 'list_support_agents') {
          const { data: agents, error: agentsError } = await admin.from('support_agents')
            .select('user_id,is_active,receive_support_notifications').in('user_id', batch);
          if (agentsError) throw agentsError;
          for (const agent of agents || []) agentsById.set(agent.user_id, agent);
        }
      }

      const ticketCounts = new Map<string, { assigned: number; open: number; closed: number }>();
      if (action === 'list_support_agents') {
        const { data: tickets, error } = await admin.from('support_tickets').select('assigned_agent_id,status').not('assigned_agent_id', 'is', null);
        if (error) throw error;
        for (const ticket of tickets || []) {
          const current = ticketCounts.get(ticket.assigned_agent_id) || { assigned: 0, open: 0, closed: 0 };
          current.assigned++;
          if (ticket.status === 'closed') current.closed++;
          else current.open++;
          ticketCounts.set(ticket.assigned_agent_id, current);
        }
      }

      const rows = authUsers.map((authUser) => {
        const profile = profilesById.get(authUser.id) || {};
        const agent = agentsById.get(authUser.id);
        return {
          id: authUser.id,
          email: authUser.email || null,
          full_name: profile.full_name || authUser.user_metadata?.full_name || null,
          username: profile.username || authUser.user_metadata?.username || null,
          role: profile.role || 'user',
          is_banned: Boolean(profile.is_banned),
          created_at: authUser.created_at,
          is_support_agent: Boolean(agent),
          support_agent_active: Boolean(agent?.is_active),
          receive_support_notifications: agent?.receive_support_notifications ?? false,
          ticket_stats: ticketCounts.get(authUser.id) || { assigned: 0, open: 0, closed: 0 }
        };
      });
      return json(action === 'list_support_agents' ? rows.filter((row) => row.is_support_agent) : rows);
    }

    if (!userId) return json({ error: 'userId is required' }, 400);
    if (userId === OWNER_ADMIN_ID) return json({ error: 'The store owner account is protected from account-management actions.' }, 400);

    if (action === 'assign_support_agent') {
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
      if (targetError || !target.user) return json({ error: 'User account not found.' }, 404);
      const { data: profile, error: profileError } = await admin.from('profiles').select('id,role,is_banned').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.is_banned) return json({ error: 'The selected user has no active profile.' }, 409);
      if (profile.role === 'admin') return json({ error: 'Site administrators cannot be assigned as support agents.' }, 409);
      const { error } = await admin.from('support_agents').upsert({
        user_id: userId, is_active: true,
        receive_support_notifications: body?.receiveNotifications !== false,
        created_by: user.id, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
    } else if (action === 'remove_support_agent') {
      const { error } = await admin.from('support_agents')
        .update({ is_active: false, receive_support_notifications: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
    } else if (action === 'set_support_agent_active') {
      const { error } = await admin.from('support_agents')
        .update({ is_active: body?.active === true, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw error;
    } else if (action === 'set_support_notifications') {
      const { error } = await admin.from('support_agents')
        .update({ receive_support_notifications: body?.enabled === true, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw error;
    } else if (action === 'ban' || action === 'unban') {
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
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
      if (error) throw error;
    } else if (action === 'update_password') {
      const password = String(body?.password || '');
      if (password.length < 8 || password.length > 72) return json({ error: 'Password must be between 8 and 72 characters.' }, 400);
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
