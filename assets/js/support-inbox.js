import { supabase, isSupabaseConfigured } from './backend.js';
import { getPreferences, savePreferences, applyTheme, resolveLanguage } from './preferences.js';

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = {
  ar: { support: 'الدعم الفني', admin: 'لوحة الإدارة', kicker: 'SUPPORT TEAM', title: 'صندوق تذاكر الدعم', subtitle: 'افتح تذكرة لمراجعة المحادثة والرد على العميل.', filter: 'تصفية حسب الحالة', all: 'الكل', refresh: 'تحديث', loading: 'جارٍ تحميل التذاكر...', error: 'تعذر تحميل التذاكر أو لا تملك صلاحية موظف الدعم.', login: 'سجّل الدخول أولاً بحساب موظف دعم فعّال.', none: 'لا توجد تذاكر في هذه الحالة.', open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_customer: 'بانتظار العميل', resolved: 'تم الحل', closed: 'مغلقة', low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة', openChat: 'فتح المحادثة', customer: 'العميل', agent: 'موظف الدعم', adminRole: 'الإدارة' },
  en: { support: 'Support', admin: 'Admin dashboard', kicker: 'SUPPORT TEAM', title: 'Support inbox', subtitle: 'Open a ticket to review the conversation and reply.', filter: 'Filter by status', all: 'All', refresh: 'Refresh', loading: 'Loading tickets...', error: 'Could not load tickets or this account is not support staff.', login: 'Sign in with an active support account first.', none: 'No tickets in this status.', open: 'Open', in_progress: 'In progress', waiting_customer: 'Waiting for customer', resolved: 'Resolved', closed: 'Closed', low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent', openChat: 'Open conversation', customer: 'Customer', agent: 'Support agent', adminRole: 'Admin' }
};
let language = resolveLanguage(getPreferences().language);
let tickets = [];
let channel;
const tr = (key) => text[language][key] || key;
function applyLanguage() {
  language = resolveLanguage(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = `${tr('title')} | 7sabatk`;
  document.querySelectorAll('[data-inbox-copy]').forEach((node) => { node.textContent = tr(node.dataset.inboxCopy); });
  $('#inboxLanguage').textContent = language === 'ar' ? 'EN' : 'عربي';
  render();
}
function render() {
  const status = $('#inboxStatus').value;
  const rows = tickets.filter((t) => status === 'all' || t.status === status);
  $('#inboxTickets').innerHTML = rows.length ? rows.map((ticket) => `<a class="support-ticket-card support-ticket-link" href="support-ticket.html?ticket=${encodeURIComponent(ticket.id)}">
    <div class="support-ticket-top"><span class="support-ticket-number">#${esc(ticket.ticket_number)}</span><time class="support-ticket-date">${esc(new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ticket.updated_at)))}</time></div>
    <h4>${esc(ticket.subject)}</h4><div class="support-ticket-meta"><span class="support-status" data-status="${esc(ticket.status)}">${esc(tr(ticket.status))}</span><span class="support-chat-priority">${esc(tr(ticket.priority))}</span><span>${ticket.last_message_role === 'customer' ? esc(tr('customer')) : esc(tr('agent'))}</span>${ticket.assigned_agent_id ? `<span>${esc(tr('agent'))}</span>` : ''}<span class="support-open-conversation">${esc(tr('openChat'))} →</span></div></a>`).join('') : `<div class="support-empty">${esc(tr('none'))}</div>`;
}
async function load() {
  $('#inboxTickets').innerHTML = `<div class="support-empty"><span class="support-spinner"></span>${esc(tr('loading'))}</div>`;
  const { data, error } = await supabase.from('support_tickets').select('id,ticket_number,subject,status,priority,updated_at,last_message_at,last_message_role,assigned_agent_id').order('updated_at', { ascending: false }).limit(100);
  if (error) { console.error('Support inbox:', error); $('#inboxError').hidden = false; $('#inboxError').textContent = tr('error'); return; }
  $('#inboxError').hidden = true;
  tickets = data || [];
  render();
}
$('#inboxLanguage').addEventListener('click', () => { const p = getPreferences(); p.language = language === 'ar' ? 'en' : 'ar'; savePreferences(p); language = p.language; applyLanguage(); });
$('#inboxTheme').addEventListener('click', () => { const p = getPreferences(); p.theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; savePreferences(p); applyTheme(p.theme); });
$('#inboxStatus').addEventListener('change', render);
$('#inboxRefresh').addEventListener('click', load);
async function boot() {
  applyTheme(getPreferences().theme);
  applyLanguage();
  if (!isSupabaseConfigured || !supabase) { $('#inboxError').hidden = false; $('#inboxError').textContent = tr('error'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { $('#inboxError').hidden = false; $('#inboxError').textContent = tr('login'); return; }
  const { data: staff, error } = await supabase.rpc('support_is_staff');
  if (error || !staff) { $('#inboxError').hidden = false; $('#inboxError').textContent = tr('error'); return; }
  const { data: owner } = await supabase.rpc('support_is_owner');
  $('#inboxAdminLink').hidden = !owner;
  await load();
  channel = supabase.channel(`support-inbox-${session.user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, load).subscribe();
  supabase.auth.onAuthStateChange((_event, next) => { if (!next) location.href = 'support.html'; });
}
window.addEventListener('beforeunload', () => { if (channel) supabase.removeChannel(channel); });
boot();
