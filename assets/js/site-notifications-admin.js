import { supabase } from './backend.js';

const OWNER_ID = 'be398df3-3918-46e1-abc4-59975ffe716b';
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let users = [];
let selected = [];
let usersLoaded = false;

function status(message, isError = false) {
  const el = $('#siteNotificationStatus');
  el.textContent = message;
  el.classList.toggle('error', isError);
}

function renderUsers() {
  $('#siteNotificationUserOptions').innerHTML = users.map((u) => `<option value="${esc(u.username)}" label="${esc(u.full_name || u.email || u.username)}"></option>`).join('');
  $('#siteNotificationSelected').innerHTML = selected.map((username) => `<span class="site-notification-chip">@${esc(username)}<button type="button" data-remove-site-user="${esc(username)}" aria-label="إزالة ${esc(username)}">×</button></span>`).join('');
  $('#siteNotificationSelected').querySelectorAll('[data-remove-site-user]').forEach((button) => button.addEventListener('click', () => {
    selected = selected.filter((username) => username.toLowerCase() !== button.dataset.removeSiteUser.toLowerCase());
    renderUsers();
  }));
}

async function loadUsers() {
  status('جارٍ تحميل أسماء المستخدمين...');
  const { data, error } = await supabase.rpc('list_site_notification_targets');
  if (error) throw error;
  users = (data || []).filter((user) => user.username).sort((a, b) => user.username.localeCompare(b.username));
  usersLoaded = true;
  renderUsers();
  status(`تم تحميل ${users.length} اسم مستخدم نشط.`);
}

$('#siteNotificationAudience').addEventListener('change', (event) => {
  const selectedMode = event.currentTarget.value === 'selected';
  $('#siteNotificationTargets').hidden = !selectedMode;
  if (selectedMode && !usersLoaded) loadUsers().catch((error) => status(`تعذر تحميل المستخدمين: ${error.message}`, true));
});

$('#addSiteNotificationUser').addEventListener('click', () => {
  const input = $('#siteNotificationUsername');
  const username = input.value.trim().replace(/^@+/, '');
  const match = users.find((user) => user.username?.toLowerCase() === username.toLowerCase());
  if (!match) { status('اختر اسم مستخدم نشطًا من القائمة.', true); return; }
  if (!selected.some((item) => item.toLowerCase() === match.username.toLowerCase())) selected.push(match.username);
  input.value = '';
  status('تمت إضافة المستخدم إلى قائمة المستلمين.');
  renderUsers();
});

$('#siteNotificationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = $('#siteNotificationTitle').value.trim();
  const message = $('#siteNotificationMessage').value.trim();
  const usernames = $('#siteNotificationAudience').value === 'all' ? null : selected;
  if (!title || !message) { status('اكتب عنوان الإشعار ونصه.', true); return; }
  if (usernames && !usernames.length) { status('أضف اسم مستخدم واحدًا على الأقل، أو اختر كل الحسابات النشطة.', true); return; }
  if (!usersLoaded) {
    try { await loadUsers(); } catch (error) { status(`تعذر تحديد المستلمين: ${error.message}`, true); return; }
  }
  const targetCount = usernames ? usernames.length : users.filter((user) => user.id !== OWNER_ID).length;
  const audienceText = usernames ? `@${usernames.join('، @')}` : `كل الحسابات النشطة (${targetCount})`;
  if (!confirm(`تأكيد إرسال الإشعار إلى ${audienceText}؟`)) return;
  const button = $('#sendSiteNotification');
  button.disabled = true;
  status('جارٍ إرسال الإشعار...');
  try {
    const { data, error } = await supabase.rpc('send_site_notification', { p_title: title, p_message: message, p_usernames: usernames });
    if (error) throw error;
    status(`تم إرسال الإشعار إلى ${Number(data || 0)} حساب.`);
    $('#siteNotificationForm').reset();
    selected = [];
    $('#siteNotificationTargets').hidden = true;
    renderUsers();
  } catch (error) {
    status(`تعذر إرسال الإشعار: ${error.message}`, true);
  } finally { button.disabled = false; }
});

window.addEventListener('7sabatk:admin-section', async (event) => {
  if (event.detail?.name !== 'site-notifications') return;
  $('#section-site-notifications').removeAttribute('hidden');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || session.user.id !== OWNER_ID) {
    status('إرسال الإشعارات متاح لمالك الموقع فقط.', true);
    $('#siteNotificationForm').hidden = true;
    return;
  }
});
