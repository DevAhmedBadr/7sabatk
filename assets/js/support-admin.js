import { supabase, isSupabaseConfigured } from './backend.js';

const OWNER_ADMIN_ID = 'be398df3-3918-46e1-abc4-59975ffe716b';
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const notify = (message) => {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
};

async function ownerAccess() {
  if (!isSupabaseConfigured || !supabase) return false;
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || session?.user?.id !== OWNER_ADMIN_ID) return false;
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role,is_banned').eq('id', OWNER_ADMIN_ID).maybeSingle();
  return !profileError && profile?.role === 'admin' && !profile?.is_banned;
}

async function adminAction(action, userId, extra = {}) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...(userId ? { userId } : {}), ...extra }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

function displaySection() {
  document.querySelectorAll('.admin-section').forEach((section) => section.classList.toggle('active', section.id === 'section-support'));
  document.querySelectorAll('.side-link').forEach((button) => button.classList.toggle('active', button.dataset.section === 'support'));
}

async function loadSupportAgents() {
  const table = $('#supportAgentsTable');
  const select = $('#supportAgentUser');
  table.innerHTML = '<tr><td colspan="8">جارٍ التحميل...</td></tr>';
  try {
    const [users, agents] = await Promise.all([
      adminAction('list_users'), adminAction('list_support_agents')
    ]);
    const available = (users || []).filter((account) => account.id !== OWNER_ADMIN_ID
      && account.role !== 'admin' && !account.is_banned && !account.is_support_agent);
    select.innerHTML = '<option value="">اختر حسابًا...</option>' + available.map((account) =>
      `<option value="${escapeHtml(account.id)}">${escapeHtml(account.full_name || account.username || account.email || account.id)} — ${escapeHtml(account.email || '')}</option>`
    ).join('');

    table.innerHTML = (agents || []).map((agent) => {
      const stats = agent.ticket_stats || {};
      return `<tr>
        <td>${escapeHtml(agent.email || '—')}</td><td>${escapeHtml(agent.full_name || agent.username || '—')}</td>
        <td><span class="status-pill ${agent.support_agent_active ? '' : 'off'}">${agent.support_agent_active ? 'نشط' : 'معطّل'}</span></td>
        <td>${stats.assigned || 0}</td><td>${stats.open || 0}</td><td>${stats.closed || 0}</td>
        <td>${agent.receive_support_notifications ? 'مفعّلة' : 'متوقفة'}</td>
        <td><div class="table-actions">
          <button data-agent-active="${escapeHtml(agent.id)}" data-value="${agent.support_agent_active ? 'true' : 'false'}">${agent.support_agent_active ? 'تعطيل' : 'إعادة تفعيل'}</button>
          <button data-agent-notify="${escapeHtml(agent.id)}" data-value="${agent.receive_support_notifications ? 'true' : 'false'}">${agent.receive_support_notifications ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}</button>
          <button class="danger" data-agent-remove="${escapeHtml(agent.id)}">إزالة الدور</button>
        </div></td></tr>`;
    }).join('') || '<tr><td colspan="8">لا يوجد موظفو دعم حتى الآن.</td></tr>';

    table.querySelectorAll('[data-agent-active]').forEach((button) => button.addEventListener('click', async () => {
      const active = button.dataset.value !== 'true';
      try { await adminAction('set_support_agent_active', button.dataset.agentActive, { active }); notify(active ? 'تم تفعيل الموظف' : 'تم تعطيل الموظف'); await loadSupportAgents(); }
      catch (error) { notify(error.message || 'تعذر تحديث الموظف'); }
    }));
    table.querySelectorAll('[data-agent-notify]').forEach((button) => button.addEventListener('click', async () => {
      const enabled = button.dataset.value !== 'true';
      try { await adminAction('set_support_notifications', button.dataset.agentNotify, { enabled }); notify('تم تحديث الإشعارات'); await loadSupportAgents(); }
      catch (error) { notify(error.message || 'تعذر تحديث الإشعارات'); }
    }));
    table.querySelectorAll('[data-agent-remove]').forEach((button) => button.addEventListener('click', async () => {
      if (!confirm('إزالة دور موظف الدعم؟ سيُمنع من الوصول إلى التذاكر.')) return;
      try { await adminAction('remove_support_agent', button.dataset.agentRemove); notify('تمت إزالة دور الدعم'); await loadSupportAgents(); }
      catch (error) { notify(error.message || 'تعذرت إزالة الدور'); }
    }));
  } catch (error) {
    table.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message || 'تعذر تحميل موظفي الدعم')}</td></tr>`;
    select.innerHTML = '<option value="">تعذر تحميل الحسابات</option>';
  }
}

if (await ownerAccess()) {
  const nav = $('#supportAgentsNav');
  const section = $('#section-support');
  nav.hidden = false;
  section.hidden = false;
  nav.addEventListener('click', async () => { displaySection(); await loadSupportAgents(); });
  $('#supportAgentForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = $('#supportAgentMessage');
    const userId = $('#supportAgentUser').value;
    if (!userId) return;
    message.textContent = 'جارٍ إضافة الموظف...';
    try {
      await adminAction('assign_support_agent', userId, {
        receiveNotifications: $('#supportAgentNotifyNew').checked
      });
      message.textContent = 'تمت إضافة موظف الدعم.';
      notify('تمت إضافة موظف الدعم');
      await loadSupportAgents();
    } catch (error) { message.textContent = error.message || 'تعذرت إضافة الموظف'; }
  });
}
