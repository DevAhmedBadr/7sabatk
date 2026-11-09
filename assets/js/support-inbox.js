import { supabase, isSupabaseConfigured } from './backend.js';
import { getPreferences, applyTheme, resolveLanguage } from './preferences.js';
import { getSiteLanguage } from './site-language.js';

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const copy = {
  ar: {
    home: 'الرئيسية', accounts: 'الحسابات', social: 'خدمات السوشيال ميديا', subscriptions: 'الاشتراكات', support: 'الدعم الفني', backToSupport: 'العودة إلى مركز الدعم الفني',
    kicker: 'SUPPORT TEAM', title: 'لوحة موظفي الدعم الفني', subtitle: 'تابع التذاكر، ابحث فيها، وافتح المحادثات للرد أو الإسناد.', search: 'بحث في التذاكر', searchPlaceholder: 'رقم التذكرة أو اسم/بريد العميل أو رقم الطلب',
    statusFilter: 'الحالة', priorityFilter: 'الأولوية', categoryFilter: 'الفئة', assignmentFilter: 'الإسناد', all: 'كل الحالات', allPriorities: 'كل الأولويات', allCategories: 'كل الفئات', allAssignments: 'كل التذاكر',
    refresh: 'تحديث', loading: 'جارٍ تحميل التذاكر...', error: 'تعذر تحميل لوحة الدعم. تحقق من تشغيل تحديث المرحلة السادسة وصلاحية الموظف.', login: 'سجّل الدخول بحساب موظف دعم فعّال أولاً.', none: 'لا توجد تذاكر تطابق البحث والمرشحات.',
    total: 'إجمالي التذاكر', new: 'جديدة', open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_customer: 'بانتظار العميل', resolved: 'تم الحل', closed: 'مغلقة', assigned_to_me: 'المسندة إليّ', unassigned: 'غير المعينة',
    low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة', ticket: 'التذكرة', customer: 'العميل', order: 'رقم الطلب', category: 'الفئة', assignee: 'الموظف المسؤول', updated: 'آخر تحديث ↓', actions: 'الإجراء', openChat: 'فتح المحادثة', previous: 'السابق', next: 'التالي', pageSummary: 'عرض {from}–{to} من {total}', noOrder: '—', noAssignee: 'غير معينة', categoryLoadError: 'تعذر تحميل قائمة الفئات.'
  },
  en: {
    home: 'Home', accounts: 'Accounts', social: 'Social services', subscriptions: 'Subscriptions', support: 'Support', backToSupport: 'Back to support center',
    kicker: 'SUPPORT TEAM', title: 'Support Agent Dashboard', subtitle: 'Track tickets, find a customer request, and open conversations to reply or assign.', search: 'Search tickets', searchPlaceholder: 'Ticket number, customer name/email, or order number',
    statusFilter: 'Status', priorityFilter: 'Priority', categoryFilter: 'Category', assignmentFilter: 'Assignment', all: 'All statuses', allPriorities: 'All priorities', allCategories: 'All categories', allAssignments: 'All tickets',
    refresh: 'Refresh', loading: 'Loading tickets...', error: 'Could not load the support dashboard. Check the phase six database update and staff access.', login: 'Sign in with an active support account first.', none: 'No tickets match these filters.',
    total: 'All tickets', new: 'New', open: 'Open', in_progress: 'In progress', waiting_customer: 'Waiting for customer', resolved: 'Resolved', closed: 'Closed', assigned_to_me: 'Assigned to me', unassigned: 'Unassigned',
    low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent', ticket: 'Ticket', customer: 'Customer', order: 'Order number', category: 'Category', assignee: 'Assigned agent', updated: 'Last updated ↓', actions: 'Action', openChat: 'Open conversation', previous: 'Previous', next: 'Next', pageSummary: 'Showing {from}–{to} of {total}', noOrder: '—', noAssignee: 'Unassigned', categoryLoadError: 'Could not load categories.'
  }
};
const PAGE_SIZE = 25;
let language = resolveLanguage(getPreferences().language);
let tickets = [];
let stats = {};
let categories = [];
let page = 1;
let pageCount = 1;
let totalFiltered = 0;
let channel;
let requestVersion = 0;
let searchTimer;
const tr = (key) => copy[language][key] || key;

function applyLanguage() {
  language = resolveLanguage(language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.title = `${tr('title')} | 7sabatk`;
  document.querySelectorAll('[data-inbox-copy]').forEach((node) => { node.textContent = tr(node.dataset.inboxCopy); });
  $('#inboxSearch').placeholder = tr('searchPlaceholder');
  fillCategoryOptions();
  renderStats();
  renderTickets();
  renderPagination();
}

function renderStats() {
  const keys = ['total', 'new', 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'assigned_to_me', 'unassigned'];
  $('#inboxStats').innerHTML = keys.map((key) => `<article class="support-stat-card"><span>${esc(tr(key))}</span><strong>${Number(stats[key] || 0).toLocaleString(language === 'ar' ? 'ar' : 'en')}</strong></article>`).join('');
}

function categoryName(category) {
  return language === 'ar' ? category.category_ar : category.category_en;
}

function fillCategoryOptions() {
  const select = $('#inboxCategory');
  if (!select) return;
  const selected = select.value || 'all';
  select.innerHTML = `<option value="all">${esc(tr('allCategories'))}</option>${categories.map((item) => `<option value="${esc(item.id)}">${esc(language === 'ar' ? item.name_ar : item.name_en)}</option>`).join('')}`;
  select.value = [...select.options].some((option) => option.value === selected) ? selected : 'all';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderTickets() {
  const body = $('#inboxTickets');
  if (!tickets.length) {
    body.innerHTML = `<tr><td colspan="9" class="support-empty">${esc(tr('none'))}</td></tr>`;
    return;
  }
  body.innerHTML = tickets.map((ticket) => {
    const category = language === 'ar' ? ticket.category_ar : ticket.category_en;
    const subcategory = language === 'ar' ? ticket.subcategory_ar : ticket.subcategory_en;
    return `<tr>
      <td><a class="support-dashboard-ticket" href="support-ticket.html?ticket=${encodeURIComponent(ticket.id)}">#${esc(ticket.ticket_number)}</a><span class="support-dashboard-subject">${esc(ticket.subject)}</span></td>
      <td><strong>${esc(ticket.customer_name || '—')}</strong>${ticket.customer_username ? `<span class="support-dashboard-subject">@${esc(ticket.customer_username)}</span>` : ''}<span class="support-dashboard-subject" dir="ltr">${esc(ticket.customer_email || '—')}</span></td>
      <td>${esc(ticket.order_id || tr('noOrder'))}</td>
      <td>${esc(category || '—')}${subcategory ? `<span class="support-dashboard-subject">${esc(subcategory)}</span>` : ''}</td>
      <td><span class="support-status" data-status="${esc(ticket.status)}">${esc(tr(ticket.status))}</span></td>
      <td><span class="support-dashboard-priority" data-priority="${esc(ticket.priority)}">${esc(tr(ticket.priority))}</span></td>
      <td>${esc(ticket.assigned_agent_name || tr('noAssignee'))}</td>
      <td><time>${esc(formatDate(ticket.updated_at))}</time></td>
      <td><a class="support-dashboard-open" href="support-ticket.html?ticket=${encodeURIComponent(ticket.id)}">${esc(tr('openChat'))} →</a></td>
    </tr>`;
  }).join('');
}

function renderPagination() {
  const from = totalFiltered ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, totalFiltered);
  $('#inboxPageSummary').textContent = tr('pageSummary').replace('{from}', from).replace('{to}', to).replace('{total}', totalFiltered.toLocaleString(language === 'ar' ? 'ar' : 'en'));
  $('#inboxPrev').disabled = page <= 1;
  $('#inboxNext').disabled = page >= pageCount;
}

async function loadCategories() {
  const { data, error } = await supabase.from('support_categories').select('id,name_ar,name_en').order('sort_order', { ascending: true });
  if (error) throw error;
  categories = data || [];
  fillCategoryOptions();
}

async function load() {
  const currentVersion = ++requestVersion;
  $('#inboxTickets').innerHTML = `<tr><td colspan="9" class="support-empty"><span class="support-spinner"></span>${esc(tr('loading'))}</td></tr>`;
  $('#inboxError').hidden = true;
  const { data, error } = await supabase.rpc('support_staff_dashboard', {
    p_search: $('#inboxSearch').value.trim() || null,
    p_status: $('#inboxStatus').value,
    p_priority: $('#inboxPriority').value,
    p_category: $('#inboxCategory').value === 'all' ? null : Number($('#inboxCategory').value),
    p_scope: $('#inboxScope').value,
    p_page: page,
    p_page_size: PAGE_SIZE
  });
  if (currentVersion !== requestVersion) return;
  if (error) {
    console.error('Support dashboard:', error);
    $('#inboxError').hidden = false;
    $('#inboxError').textContent = tr('error');
    tickets = [];
    renderTickets();
    return;
  }
  stats = data?.stats || {};
  tickets = data?.tickets || [];
  totalFiltered = Number(data?.total_filtered || 0);
  pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  if (page > pageCount) { page = pageCount; return load(); }
  renderStats();
  renderTickets();
  renderPagination();
}

function resetAndLoad() { page = 1; load(); }
$('#inboxStatus').addEventListener('change', resetAndLoad);
$('#inboxPriority').addEventListener('change', resetAndLoad);
$('#inboxCategory').addEventListener('change', resetAndLoad);
$('#inboxScope').addEventListener('change', resetAndLoad);
$('#inboxSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(resetAndLoad, 300); });
$('#inboxRefresh').addEventListener('click', load);
$('#inboxPrev').addEventListener('click', () => { if (page > 1) { page -= 1; load(); } });
$('#inboxNext').addEventListener('click', () => { if (page < pageCount) { page += 1; load(); } });

async function boot() {
  language = await getSiteLanguage();
  applyTheme(getPreferences().theme);
  applyLanguage();
  if (!isSupabaseConfigured || !supabase) { $('#inboxError').hidden = false; $('#inboxError').textContent = tr('error'); return; }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { $('#inboxError').hidden = false; $('#inboxError').textContent = tr('login'); return; }
  const { data: staff, error } = await supabase.rpc('support_is_staff');
  if (error || !staff) { $('#inboxError').hidden = false; $('#inboxError').textContent = tr('error'); return; }
  try { await loadCategories(); } catch (error) { console.warn('Support categories unavailable:', error.message); }
  await load();
  channel = supabase.channel(`support-inbox-${session.user.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, load)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_category_catalog_state', filter: 'singleton=eq.true' }, () => loadCategories().catch((categoryError) => console.warn('Support categories refresh:', categoryError.message)))
    .subscribe();
  supabase.auth.onAuthStateChange((_event, next) => { if (!next) location.href = 'support.html'; });
}
window.addEventListener('beforeunload', () => { if (channel) supabase.removeChannel(channel); });
boot();
