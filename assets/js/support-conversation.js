import { supabase, isSupabaseConfigured } from './backend.js';
import { getPreferences, applyTheme, resolveLanguage } from './preferences.js';
import { getSiteLanguage, applySiteHeader } from './site-language.js';

const $ = (selector) => document.querySelector(selector);
const ticketId = new URLSearchParams(location.search).get('ticket');
const supportBadge = 'assets/images/sevenx-support-agent-badge.png';
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = {
  ar: { home: 'الرئيسية', accounts: 'الحسابات', social: 'خدمات السوشيال ميديا', subscriptions: 'الاشتراكات', support: 'الدعم الفني', kicker: 'TICKET CONVERSATION', title: 'محادثة الدعم', loading: 'جارٍ تحميل التذكرة...', error: 'تعذر فتح هذه التذكرة. تأكد من تسجيل الدخول بحساب يملك صلاحية الوصول.', login: 'سجّل الدخول من صفحة الدعم أولاً.', statusLabel: 'الحالة', priorityLabel: 'الأولوية', assignLabel: 'إسناد لموظف', internal: 'ملاحظة داخلية (لا تظهر للعميل)', replyLabel: 'اكتب ردك', attach: 'إرفاق ملفات', fileHint: 'JPG/PNG/PDF · حتى 5 ملفات · 5MB لكل ملف', send: 'إرسال الرد', sending: 'جارٍ إرسال الرد...', sent: 'تم إرسال الرد.', partial: 'تم إرسال الرد لكن تعذر رفع بعض المرفقات.', back: 'العودة إلى مركز الدعم الفني', staffBack: 'العودة إلى صندوق الدعم الفني', customer: 'العميل', agent: 'موظف الدعم', admin: 'الإدارة', system: 'النظام', open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_customer: 'بانتظار العميل', resolved: 'تم الحل', closed: 'مغلقة', low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة', none: 'بدون إسناد', updateError: 'تعذر حفظ التغيير.', staffError: 'تعذر تحميل أسماء الموظفين.', attachmentError: 'المرفق غير صالح أو يتجاوز الحجم المسموح.', noMessages: 'لا توجد رسائل.', ticketClosed: 'هذه التذكرة مغلقة. أعد فتحها أو تواصل مع الدعم لإضافة رد.' },
  en: { home: 'Home', accounts: 'Accounts', social: 'Social services', subscriptions: 'Subscriptions', support: 'Support', kicker: 'TICKET CONVERSATION', title: 'Support conversation', loading: 'Loading ticket...', error: 'Could not open this ticket. Sign in with an account that has access.', login: 'Sign in from the support page first.', statusLabel: 'Status', priorityLabel: 'Priority', assignLabel: 'Assign to agent', internal: 'Internal note (hidden from customer)', replyLabel: 'Write a reply', attach: 'Attach files', fileHint: 'JPG/PNG/PDF · up to 5 files · 5MB each', send: 'Send reply', sending: 'Sending reply...', sent: 'Reply sent.', partial: 'Reply sent, but some attachments failed to upload.', back: 'Back to support center', staffBack: 'Back to support inbox', customer: 'Customer', agent: 'Support agent', admin: 'Admin', system: 'System', open: 'Open', in_progress: 'In progress', waiting_customer: 'Waiting for customer', resolved: 'Resolved', closed: 'Closed', low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent', none: 'Unassigned', updateError: 'Could not save this change.', staffError: 'Could not load support agents.', attachmentError: 'A file is invalid or exceeds the allowed size.', noMessages: 'No messages.', ticketClosed: 'This ticket is closed. Reopen it or contact support before replying.' }
};
let language = resolveLanguage(getPreferences().language);
let session = null;
let staff = false;
let currentTicket = null;
let realtime = null;
let agents = [];
let loading = false;
let refreshTimer = null;
const tr = (key) => copy[language][key] || key;

function setMessage(text = '', kind = '') {
  const node = $('#chatMessageStatus');
  node.textContent = text;
  node.className = `support-form-message${kind ? ` ${kind}` : ''}`;
}
function displayError(text) {
  $('#chatPanel').hidden = true;
  $('#chatError').hidden = false;
  $('#chatError').textContent = text;
  $('#chatSubheading').textContent = '';
}
function roleLabel(role) { return tr(role === 'customer' ? 'customer' : role === 'admin' ? 'admin' : role === 'system' ? 'system' : 'agent'); }
function statusLabel(status) { return tr(status); }
function applyLanguage(next = language) {
  language = resolveLanguage(next);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = `${tr('title')} | 7sabatk`;
  applySiteHeader(language);
  document.querySelectorAll('[data-chat-copy]').forEach((node) => { node.textContent = tr(node.dataset.chatCopy); });
  if (currentTicket) renderConversation(currentTicket);
}
function formatDate(value) {
  try { return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return ''; }
}
function renderConversation(rows) {
  if (!rows?.length) return;
  currentTicket = rows;
  const ticket = rows[0];
  $('#chatPanel').hidden = false;
  $('#chatError').hidden = true;
  $('#chatSubheading').textContent = language === 'ar' ? `رقم التذكرة ${ticket.out_ticket_number}` : `Ticket #${ticket.out_ticket_number}`;
  $('#chatTicketNumber').textContent = `#${ticket.out_ticket_number}`;
  $('#chatSubject').textContent = ticket.out_subject;
  $('#chatStatus').textContent = statusLabel(ticket.out_status);
  $('#chatStatus').dataset.status = ticket.out_status;
  $('#chatPriority').textContent = tr(ticket.out_priority);
  $('#chatReply').disabled = ticket.out_status === 'closed' && !staff;
  $('#chatSend').disabled = ticket.out_status === 'closed' && !staff;
  $('#chatReply').placeholder = ticket.out_status === 'closed' && !staff ? tr('ticketClosed') : '';
  $('#staffControls').hidden = !staff;
  $('#internalToggle').hidden = !staff;
  if (staff) {
    $('#chatStatusSelect').value = ticket.out_status;
    $('#chatPrioritySelect').value = ticket.out_priority;
    $('#chatAssignee').value = ticket.out_assigned_agent_id || '';
  }
  const list = $('#chatMessages');
  if (!rows.length) { list.innerHTML = `<div class="support-empty">${safe(tr('noMessages'))}</div>`; return; }
  list.innerHTML = rows.map((row) => {
    const own = row.out_sender_id === session.user.id;
    const isSupportSender = row.out_sender_role === 'agent' || row.out_sender_role === 'admin';
    const avatarUrl = isSupportSender ? supportBadge : row.out_sender_avatar_url;
    const avatarInitial = (row.out_sender_name || roleLabel(row.out_sender_role)).trim().slice(0, 1) || '7';
    return `<div class="support-message-row ${own ? 'is-own' : ''} ${isSupportSender ? 'is-support-sender' : 'is-customer-sender'}">
      <div class="support-message-avatar ${isSupportSender ? 'support-agent-avatar' : ''}" aria-label="${safe(roleLabel(row.out_sender_role))}">${avatarUrl ? `<img src="${safe(avatarUrl)}" alt="${safe(roleLabel(row.out_sender_role))}" loading="lazy" data-avatar-fallback="${safe(avatarInitial)}">` : `<span>${safe(avatarInitial)}</span>`}</div>
      <article class="support-message-bubble ${own ? 'is-own' : ''} ${row.out_is_internal ? 'is-internal' : ''}" data-message-id="${safe(row.out_message_id)}">
      <div class="support-message-meta"><strong>${safe(own ? (language === 'ar' ? 'أنت' : 'You') : row.out_sender_name || roleLabel(row.out_sender_role))}</strong><span>${safe(formatDate(row.out_message_created_at))}</span>${row.out_is_internal ? `<span class="support-note-tag">${safe(tr('internal'))}</span>` : ''}</div>
      <p>${safe(row.out_message).replace(/\n/g, '<br>')}</p><div class="support-message-attachments" data-attachments-for="${safe(row.out_message_id)}"></div>
      </article></div>`;
  }).join('');
  list.querySelectorAll('img[data-avatar-fallback]').forEach((image) => image.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.textContent = image.dataset.avatarFallback;
    image.replaceWith(fallback);
  }, { once: true }));
  list.scrollTop = list.scrollHeight;
  loadAttachmentLinks(rows);
}
async function loadAttachmentLinks(rows) {
  const ids = rows.map((row) => row.out_message_id);
  if (!ids.length) return;
  const { data, error } = await supabase.from('support_attachments').select('message_id,file_name,file_path').in('message_id', ids);
  if (error || !data?.length) return;
  for (const attachment of data) {
    const holder = document.querySelector(`[data-attachments-for="${CSS.escape(String(attachment.message_id))}"]`);
    if (!holder) continue;
    const { data: signed } = await supabase.storage.from('support-attachments').createSignedUrl(attachment.file_path, 300);
    if (signed?.signedUrl) holder.insertAdjacentHTML('beforeend', `<a href="${safe(signed.signedUrl)}" target="_blank" rel="noopener noreferrer">📎 ${safe(attachment.file_name)}</a>`);
  }
}
async function loadAgents() {
  if (!staff) return;
  const { data, error } = await supabase.rpc('support_list_active_agents');
  if (error) throw error;
  agents = data || [];
  $('#chatAssignee').innerHTML = `<option value="">${safe(tr('none'))}</option>` + agents.map((a) => `<option value="${safe(a.agent_id)}">${safe(a.display_name)}</option>`).join('');
}
async function loadConversation() {
  if (loading || !session || !ticketId) return;
  loading = true;
  try {
    const { data, error } = await supabase.rpc('support_get_conversation_v2', { p_ticket_id: ticketId });
    if (error) throw error;
    if (!data?.length) throw new Error('empty_conversation');
    renderConversation(data);
    const { error: readError } = await supabase.rpc('support_mark_ticket_read', { p_ticket_id: ticketId });
    if (readError) console.warn('Could not update ticket read marker:', readError.message);
  } catch (error) {
    console.error('Support conversation:', error);
    displayError(tr('error'));
  } finally { loading = false; }
}
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(loadConversation, 200);
}
function allowedFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'pdf' ? 'application/pdf' : '';
  return type && type === file.type && file.size > 0 && file.size <= 5 * 1024 * 1024 && file.name.length <= 255 && !/[\\/]/.test(file.name);
}
async function attachFiles(messageId, files) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `${ticketId}/${messageId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
    if (uploadError) throw uploadError;
    const { error: rowError } = await supabase.from('support_attachments').insert({ ticket_id: ticketId, message_id: messageId, file_name: file.name, file_path: path, file_type: file.type, file_size: file.size });
    if (rowError) throw rowError;
  }
}
async function updateTicket(field, value) {
  const update = { [field]: value };
  const { error } = await supabase.from('support_tickets').update(update).eq('id', ticketId);
  if (error) { console.error(error); setMessage(tr('updateError'), 'error'); return; }
  setMessage('');
  await loadConversation();
}

$('#chatStatusSelect').addEventListener('change', (e) => updateTicket('status', e.target.value));
$('#chatPrioritySelect').addEventListener('change', (e) => updateTicket('priority', e.target.value));
$('#chatAssignee').addEventListener('change', (e) => updateTicket('assigned_agent_id', e.target.value || null));
$('#chatReplyForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('#chatReply').value.trim();
  const files = Array.from($('#chatFiles').files || []);
  if (!message) return;
  if (files.length > 5 || files.some((f) => !allowedFile(f))) { setMessage(tr('attachmentError'), 'error'); return; }
  const button = $('#chatSend');
  button.disabled = true;
  setMessage(tr('sending'));
  let sent = false;
  try {
    const { data, error } = await supabase.from('support_messages').insert({ ticket_id: ticketId, message, is_internal: staff && $('#chatInternal').checked }).select('id').single();
    if (error) throw error;
    sent = true;
    if (files.length) await attachFiles(data.id, files);
    $('#chatReply').value = '';
    $('#chatFiles').value = '';
    $('#chatInternal').checked = false;
    setMessage(tr('sent'), 'success');
    await loadConversation();
  } catch (error) {
    console.error('Support reply:', error);
    setMessage(sent ? tr('partial') : (error.message === 'ticket_closed' ? 'ticket_closed' : tr('error')), 'error');
    if (sent) await loadConversation();
  } finally { button.disabled = false; }
});

async function boot() {
  language = await getSiteLanguage();
  applyTheme(getPreferences().theme);
  applyLanguage();
  if (!isSupabaseConfigured || !supabase) { displayError(tr('error')); return; }
  if (!ticketId) { displayError(tr('error')); return; }
  const { data: { session: activeSession } } = await supabase.auth.getSession();
  session = activeSession;
  if (!session) { displayError(tr('login')); return; }
  const { data: canStaff, error } = await supabase.rpc('support_is_staff');
  if (!error) staff = Boolean(canStaff);
  $('#chatStaffInboxBack').hidden = !staff;
  if (staff) {
    try { await loadAgents(); } catch (agentError) { console.warn('Agent roster unavailable:', agentError.message); setMessage(tr('staffError'), 'error'); }
  }
  await loadConversation();
  realtime = supabase.channel(`support-ticket-${ticketId}-${session.user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` }, scheduleRefresh)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` }, scheduleRefresh)
    .subscribe();
  supabase.auth.onAuthStateChange((_event, next) => { if (!next) location.href = 'support.html'; });
}
window.addEventListener('beforeunload', () => { if (realtime) supabase.removeChannel(realtime); });
boot();
