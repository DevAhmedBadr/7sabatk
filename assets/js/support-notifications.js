import { supabase, isSupabaseConfigured } from './backend.js';
import { getPreferences, resolveLanguage } from './preferences.js';
import { getSiteLanguage, applySiteHeader } from './site-language.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (selector) => document.querySelector(selector);
let lang = resolveLanguage(getPreferences().language);
let text = lang === 'ar'
  ? { title: 'الإشعارات', empty: 'لا توجد إشعارات.', readAll: 'تحديد الكل كمقروء', ticket_created: 'تذكرة دعم جديدة', new_reply: 'رد جديد من فريق الدعم', customer_reply: 'رد جديد من عميل', status_changed: 'تم تحديث حالة التذكرة', assigned: 'تم إسناد تذكرة إليك', error: 'تعذر تحميل الإشعارات' }
  : { title: 'Notifications', empty: 'No notifications yet.', readAll: 'Mark all as read', ticket_created: 'New support ticket', new_reply: 'New reply from support', customer_reply: 'New customer reply', status_changed: 'Ticket status updated', assigned: 'A ticket was assigned to you', error: 'Could not load notifications' };
let userId;
let channel;
let ticketsById = {};
let rows = [];

function mount() {
  const host = document.querySelector('.nav-links') || document.querySelector('.admin-top');
  if (!host || document.querySelector('#supportNotificationRoot')) return;
  const root = document.createElement('div');
  root.id = 'supportNotificationRoot';
  root.className = 'support-notification-root';
  root.innerHTML = `<button class="support-notification-toggle" id="supportNotificationToggle" type="button" aria-label="${esc(text.title)}" aria-expanded="false"><span aria-hidden="true">🔔</span><span>${esc(text.title)}</span><b id="supportNotificationCount" hidden></b></button><section class="support-notification-panel" id="supportNotificationPanel" hidden><header><strong>${esc(text.title)}</strong><button type="button" id="supportNotificationReadAll">${esc(text.readAll)}</button></header><div id="supportNotificationList"><p>${esc(text.empty)}</p></div></section>`;
  host.append(root);
  $('#supportNotificationToggle').addEventListener('click', () => {
    const panel = $('#supportNotificationPanel');
    panel.hidden = !panel.hidden;
    $('#supportNotificationToggle').setAttribute('aria-expanded', String(!panel.hidden));
  });
  $('#supportNotificationReadAll').addEventListener('click', markAllRead);
  document.addEventListener('click', (event) => { if (!root.contains(event.target)) { $('#supportNotificationPanel').hidden = true; $('#supportNotificationToggle').setAttribute('aria-expanded', 'false'); } });
}

function render() {
  const unread = rows.filter((r) => !r.is_read).length;
  const badge = $('#supportNotificationCount');
  badge.hidden = unread === 0;
  badge.textContent = unread > 99 ? '99+' : String(unread);
  const list = $('#supportNotificationList');
  if (!rows.length) { list.innerHTML = `<p class="support-notification-empty">${esc(text.empty)}</p>`; return; }
  list.innerHTML = rows.map((r) => {
    const stamp = esc(new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.created_at)));
    if (r.kind === 'site') return `<button class="support-notification-item support-site-notification ${r.is_read ? 'is-read' : 'is-unread'}" type="button" data-notification-id="${r.id}" data-notification-kind="site"><span class="support-notification-dot" aria-hidden="true"></span><span class="support-notification-copy"><strong>${esc(r.title)}</strong><span>${esc(r.message)}</span><time>${stamp}</time></span></button>`;
    const t = ticketsById[r.ticket_id] || {};
    const subject = t.subject || (lang === 'ar' ? `التذكرة #${t.ticket_number || ''}` : `Ticket #${t.ticket_number || ''}`);
    const title = text[r.type] || text.title;
    const href = `support-ticket.html?ticket=${encodeURIComponent(r.ticket_id)}`;
    return `<a class="support-notification-item ${r.is_read ? 'is-read' : 'is-unread'}" href="${href}" data-notification-id="${r.id}" data-notification-kind="support"><span class="support-notification-dot" aria-hidden="true"></span><span class="support-notification-copy"><strong>${esc(title)}</strong><span>${esc(subject)}</span><time>${stamp}</time></span></a>`;
  }).join('');
}

async function load() {
  const [supportResult, siteResult] = await Promise.all([
    supabase.from('support_notifications').select('id,user_id,ticket_id,message_id,type,is_read,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(15),
    supabase.from('site_notifications').select('id,user_id,title,message,is_read,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(15)
  ]);
  if (supportResult.error) { $('#supportNotificationList').innerHTML = `<p class="support-notification-empty">${esc(text.error)}</p>`; return; }
  if (siteResult.error) console.warn('Site notifications are unavailable until the admin notifications migration is applied:', siteResult.error.message);
  rows = [...(supportResult.data || []).map((r) => ({ ...r, kind: 'support' })), ...(siteResult.error ? [] : (siteResult.data || []).map((r) => ({ ...r, kind: 'site' })))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 20);
  const ids = [...new Set(rows.filter((r) => r.kind === 'support').map((r) => r.ticket_id))];
  if (ids.length) {
    const result = await supabase.from('support_tickets').select('id,ticket_number,subject').in('id', ids);
    if (!result.error) ticketsById = Object.fromEntries((result.data || []).map((t) => [t.id, t]));
  }
  render();
}

async function markRead(id, kind = 'support') {
  const row = rows.find((r) => String(r.id) === String(id) && r.kind === kind);
  if (!row || row.is_read) return;
  const table = kind === 'site' ? 'site_notifications' : 'support_notifications';
  const { error } = await supabase.from(table).update({ is_read: true, read_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', userId);
  if (!error) { row.is_read = true; render(); }
}

async function markAllRead() {
  if (!rows.some((r) => !r.is_read)) return;
  const results = await Promise.all(['support_notifications', 'site_notifications'].map((table) => supabase.from(table).update({ is_read: true, read_at: new Date().toISOString() }).eq('user_id', userId).eq('is_read', false)));
  if (results.every((r) => !r.error)) { rows.forEach((r) => { r.is_read = true; }); render(); }
}

async function boot() {
  lang = await getSiteLanguage();
  text = lang === 'ar'
    ? { title: 'الإشعارات', empty: 'لا توجد إشعارات.', readAll: 'تحديد الكل كمقروء', ticket_created: 'تذكرة دعم جديدة', new_reply: 'رد جديد من فريق الدعم', customer_reply: 'رد جديد من عميل', status_changed: 'تم تحديث حالة التذكرة', assigned: 'تم إسناد تذكرة إليك', error: 'تعذر تحميل الإشعارات' }
    : { title: 'Notifications', empty: 'No notifications yet.', readAll: 'Mark all as read', ticket_created: 'New support ticket', new_reply: 'New reply from support', customer_reply: 'New customer reply', status_changed: 'Ticket status updated', assigned: 'A ticket was assigned to you', error: 'Could not load notifications' };
  if (!isSupabaseConfigured || !supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  userId = session.user.id;
  mount();
  await applySiteHeader(lang);
  await load();
  const ticketId = new URLSearchParams(location.search).get('ticket');
  if (location.pathname.endsWith('support-ticket.html') && ticketId) {
    const ticketRows = rows.filter((r) => r.kind === 'support' && r.ticket_id === ticketId && !r.is_read);
    for (const row of ticketRows) await markRead(row.id, 'support');
  }
  $('#supportNotificationList')?.addEventListener('click', async (event) => {
    const item = event.target.closest('[data-notification-id]');
    if (!item) return;
    if (item.dataset.notificationKind === 'site') { await markRead(item.dataset.notificationId, 'site'); return; }
    event.preventDefault();
    await markRead(item.dataset.notificationId, 'support');
    location.href = item.href;
  });
  channel = supabase.channel(`support-notifications-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_notifications', filter: `user_id=eq.${userId}` }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_notifications', filter: `user_id=eq.${userId}` }, load)
    .subscribe();
  supabase.auth.onAuthStateChange((_event, next) => { if (!next) { document.querySelector('#supportNotificationRoot')?.remove(); if (channel) supabase.removeChannel(channel); } });
}
window.addEventListener('beforeunload', () => { if (channel) supabase.removeChannel(channel); });
boot();
