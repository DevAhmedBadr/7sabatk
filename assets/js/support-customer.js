import { supabase, isSupabaseConfigured } from './backend.js';
import { getPreferences, applyTheme, resolveLanguage } from './preferences.js';

const $ = (selector) => document.querySelector(selector);
const form = $('#supportTicketForm');
if (form) {
  const copy = {
    ar: {
      home: 'الرئيسية', accounts: 'الحسابات', social: 'خدمات السوشيال ميديا', subscriptions: 'الاشتراكات', support: 'الدعم الفني',
      staffInbox: '▤ صندوق الدعم', openConversation: 'فتح المحادثة', unread: 'رسائل جديدة', backToHome: 'العودة إلى الصفحة الرئيسية',
      kicker: 'CUSTOMER CARE', title: 'مركز الدعم الفني', subtitle: 'افتح تذكرة وسنتابع طلبك من حسابك.',
      loginTitle: 'الدعم متاح لأصحاب الحسابات', loginText: 'سجّل الدخول أو أنشئ حسابًا لمتابعة طلبات الدعم.', loginButton: 'تسجيل الدخول', createAccount: 'إنشاء حساب', signedIn: 'أنت مسجل الدخول',
      authTitle: 'تسجيل الدخول', authText: 'استخدم حسابك الحالي في موقع حساباتك.', identifierLabel: 'البريد الإلكتروني أو اسم المستخدم', passwordLabel: 'كلمة المرور', authError: 'تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.', loggingIn: 'جارٍ تسجيل الدخول...', footer: 'جميع الحقوق محفوظة.', backHome: 'العودة للرئيسية',
      formTitle: 'إنشاء تذكرة جديدة', formText: 'اكتب تفاصيل المشكلة وسيراجعها فريق الدعم.',
      categoryLabel: 'الفئة', subcategoryLabel: 'الفئة الفرعية', orderLabel: 'رقم الطلب (اختياري)',
      orderPlaceholder: 'أدخل رقم الطلب إن وُجد', orderNote: 'الرقم يُحفظ كمرجع فقط؛ ربطه والتحقق من ملكيته يحتاجان جدول طلبات غير موجود حاليًا.',
      subjectLabel: 'عنوان التذكرة', subjectPlaceholder: 'اكتب عنوانًا مختصرًا للمشكلة', messageLabel: 'تفاصيل المشكلة',
      messagePlaceholder: 'اشرح المشكلة بالتفصيل...', attachmentLabel: 'إرفاق ملفات', attachmentHelp: 'JPG أو PNG أو PDF، بحد أقصى 5 ملفات و5MB لكل ملف.',
      submit: 'إرسال التذكرة', historyTitle: 'تذاكري', historyText: 'آخر طلبات الدعم المرتبطة بحسابك.', refresh: 'تحديث التذاكر',
      loadingCategories: 'جارٍ تحميل الفئات...', chooseCategory: 'اختر الفئة...', subcategoryOptional: 'بدون فئة فرعية (اختياري)',
      loadingTickets: 'جارٍ تحميل التذاكر...', noTickets: 'لا توجد تذاكر حتى الآن.', categoriesError: 'تعذر تحميل الفئات. تأكد من تطبيق ملفات دعم المرحلة الثانية.',
      ticketsError: 'تعذر تحميل التذاكر. حاول تحديث القائمة.', loginRequired: 'سجّل الدخول بحسابك لاستخدام الدعم الفني.',
      selectCategory: 'اختر الفئة الرئيسية.', subjectRequired: 'اكتب عنوانًا من 3 أحرف على الأقل.', messageRequired: 'اكتب تفاصيل المشكلة.',
      tooManyFiles: 'يمكن إرفاق 5 ملفات كحد أقصى.', invalidFile: 'الملفات المسموحة JPG وPNG وPDF فقط.',
      fileTooLarge: 'يجب ألا يتجاوز حجم كل ملف 5MB.', invalidFileName: 'اسم الملف طويل جدًا أو غير صالح.',
      sending: 'جارٍ إنشاء التذكرة ورفع المرفقات...', ticketCreated: 'تم إنشاء التذكرة رقم', partialFiles: '، لكن تعذر رفع كل المرفقات. رقم التذكرة محفوظ؛ حدّث الصفحة للتحقق من سجل التذاكر.',
      submitError: 'تعذر إرسال التذكرة. حاول مرة أخرى.', uploadError: 'تم إنشاء التذكرة، لكن تعذر رفع المرفقات.',
      attachmentRemoved: 'إزالة الملف', justNow: 'الآن', status: { open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_customer: 'بانتظار ردك', resolved: 'تم الحل', closed: 'مغلقة' },
      ticketPrefix: 'تذكرة #', categoryUnknown: 'دعم فني', remove: 'إزالة'
    },
    en: {
      home: 'Home', accounts: 'Accounts', social: 'Social services', subscriptions: 'Subscriptions', support: 'Support',
      staffInbox: '▤ Support inbox', openConversation: 'Open conversation', unread: 'New messages', backToHome: 'Back to the home page',
      kicker: 'CUSTOMER CARE', title: 'Support Center', subtitle: 'Open a ticket and follow your support requests from your account.',
      loginTitle: 'Support is available to account holders', loginText: 'Sign in or create an account to contact support.', loginButton: 'Sign in', createAccount: 'Create account', signedIn: 'You are signed in',
      authTitle: 'Sign in', authText: 'Use your existing 7sabatk account.', identifierLabel: 'Email or username', passwordLabel: 'Password', authError: 'Could not sign in. Check your details and try again.', loggingIn: 'Signing in...', footer: 'All rights reserved.', backHome: 'Back to home',
      formTitle: 'Create a new ticket', formText: 'Describe the issue and our support team will review it.',
      categoryLabel: 'Category', subcategoryLabel: 'Subcategory', orderLabel: 'Order number (optional)',
      orderPlaceholder: 'Enter an order number if applicable', orderNote: 'Saved as a reference only. Automatic order ownership checks need an orders table, which this project does not currently have.',
      subjectLabel: 'Ticket subject', subjectPlaceholder: 'Summarize the issue', messageLabel: 'Issue details',
      messagePlaceholder: 'Describe the issue in detail...', attachmentLabel: 'Attach files', attachmentHelp: 'JPG, PNG or PDF; up to 5 files and 5MB per file.',
      submit: 'Submit ticket', historyTitle: 'My tickets', historyText: 'Recent support requests linked to your account.', refresh: 'Refresh tickets',
      loadingCategories: 'Loading categories...', chooseCategory: 'Choose a category...', subcategoryOptional: 'No subcategory (optional)',
      loadingTickets: 'Loading tickets...', noTickets: 'You have no tickets yet.', categoriesError: 'Could not load categories. Check that the support database setup is applied.',
      ticketsError: 'Could not load tickets. Try refreshing the list.', loginRequired: 'Sign in to use technical support.',
      selectCategory: 'Choose a main category.', subjectRequired: 'Enter a subject with at least 3 characters.', messageRequired: 'Enter the issue details.',
      tooManyFiles: 'You can attach up to 5 files.', invalidFile: 'Only JPG, PNG and PDF files are allowed.',
      fileTooLarge: 'Each file must be 5MB or smaller.', invalidFileName: 'The file name is too long or invalid.',
      sending: 'Creating the ticket and uploading attachments...', ticketCreated: 'Ticket created: #', partialFiles: '. The ticket is saved, but not all attachments uploaded. Refresh the ticket list to confirm.',
      submitError: 'Could not submit the ticket. Please try again.', uploadError: 'The ticket was created, but attachments could not be uploaded.',
      attachmentRemoved: 'Remove file', justNow: 'Just now', status: { open: 'Open', in_progress: 'In progress', waiting_customer: 'Waiting for you', resolved: 'Resolved', closed: 'Closed' },
      ticketPrefix: 'Ticket #', categoryUnknown: 'Support', remove: 'Remove'
    }
  };

  let language = resolveLanguage(getPreferences().language);
  let session = null;
  let categories = [];
  let subcategories = [];
  let requestKey = null;
  let requestFingerprint = '';

  function tr(key) { return copy[language][key]; }
  function openAuthDialog() {
    const dialog = $('#supportAuthDialog');
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    document.body.classList.add('support-auth-open');
    $('#supportAuthIdentifier').focus();
  }
  function closeAuthDialog() {
    const dialog = $('#supportAuthDialog');
    dialog.classList.remove('open');
    dialog.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('support-auth-open');
  }
  function showMessage(message = '', kind = '') {
    const node = $('#supportFormMessage');
    node.textContent = message;
    node.className = `support-form-message${kind ? ` ${kind}` : ''}`;
  }
  function applyLanguage(nextLanguage = document.documentElement.lang) {
    language = resolveLanguage(nextLanguage);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = language === 'ar' ? 'الدعم الفني | 7sabatk' : 'Support Center | 7sabatk';
    document.querySelectorAll('[data-support-copy]').forEach((node) => {
      const value = tr(node.dataset.supportCopy);
      if (typeof value === 'string') node.textContent = value;
    });
    document.querySelectorAll('[data-support-placeholder]').forEach((node) => {
      const value = tr(node.dataset.supportPlaceholder);
      if (typeof value === 'string') node.placeholder = value;
    });
    $('#supportRefresh').setAttribute('aria-label', tr('refresh'));
    $('#supportRefresh').title = tr('refresh');
    renderCategories();
    renderSubcategories();
    if (session) loadTickets();
  }
  function renderCategories() {
    const select = $('#supportCategory');
    const selected = select.value;
    select.innerHTML = `<option value="">${tr('chooseCategory')}</option>` + categories.map((category) => {
      const name = language === 'ar' ? category.name_ar : category.name_en;
      return `<option value="${category.id}">${escapeHtml(name)}</option>`;
    }).join('');
    if (categories.some((category) => String(category.id) === selected)) select.value = selected;
  }
  function renderSubcategories() {
    const select = $('#supportSubcategory');
    const categoryId = $('#supportCategory').value;
    const previous = select.value;
    const matching = subcategories.filter((item) => String(item.category_id) === categoryId);
    select.disabled = !matching.length;
    select.innerHTML = `<option value="">${tr('subcategoryOptional')}</option>` + matching.map((item) => {
      const name = language === 'ar' ? item.name_ar : item.name_en;
      return `<option value="${item.id}">${escapeHtml(name)}</option>`;
    }).join('');
    if (matching.some((item) => String(item.id) === previous)) select.value = previous;
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '';
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(date);
  }
  function setGate(isSignedIn) {
    $('#supportGuest').hidden = isSignedIn;
    $('#supportWorkspace').hidden = !isSignedIn;
  }
  async function loadCategories() {
    const { data, error } = await supabase.from('support_categories')
      .select('id,slug,name_ar,name_en,sort_order').eq('is_active', true).order('sort_order');
    if (error) throw error;
    const { data: childRows, error: childError } = await supabase.from('support_subcategories')
      .select('id,category_id,slug,name_ar,name_en,sort_order').eq('is_active', true).order('sort_order');
    if (childError) throw childError;
    categories = data || [];
    subcategories = childRows || [];
    renderCategories();
    renderSubcategories();
  }
  async function loadTickets() {
    if (!session) return;
    const list = $('#supportTickets');
    list.innerHTML = `<div class="support-empty"><span class="support-spinner"></span><span>${tr('loadingTickets')}</span></div>`;
    const { data, error } = await supabase.from('support_tickets')
      .select('id,ticket_number,subject,status,created_at,category_id,last_message_at,last_message_role')
      .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(10);
    if (error) {
      console.error('Support ticket list:', error);
      list.innerHTML = `<div class="support-empty">${escapeHtml(tr('ticketsError'))}</div>`;
      return;
    }
    if (!data?.length) {
      list.innerHTML = `<div class="support-empty">${escapeHtml(tr('noTickets'))}</div>`;
      return;
    }
    const categoryMap = new Map(categories.map((item) => [item.id, language === 'ar' ? item.name_ar : item.name_en]));
    const { data: reads } = await supabase.from('support_ticket_reads').select('ticket_id,last_read_at').eq('user_id', session.user.id);
    const readMap = new Map((reads || []).map((row) => [row.ticket_id, row.last_read_at]));
    list.innerHTML = data.map((ticket) => {
      const statusText = tr('status')[ticket.status] || ticket.status;
      const categoryText = categoryMap.get(ticket.category_id) || tr('categoryUnknown');
      const unread = ticket.last_message_role && ticket.last_message_role !== 'customer' && ticket.last_message_at && new Date(ticket.last_message_at) > new Date(readMap.get(ticket.id) || 0);
      return `<a class="support-ticket-card support-ticket-link" href="support-ticket.html?ticket=${encodeURIComponent(ticket.id)}">
        <div class="support-ticket-top"><span class="support-ticket-number">${escapeHtml(tr('ticketPrefix'))}${escapeHtml(ticket.ticket_number)}</span><time class="support-ticket-date" datetime="${escapeHtml(ticket.created_at)}">${escapeHtml(formatDate(ticket.created_at))}</time></div>
        <h4>${escapeHtml(ticket.subject)}</h4>
        <div class="support-ticket-meta"><span class="support-ticket-category">${escapeHtml(categoryText)}</span><span class="support-status" data-status="${escapeHtml(ticket.status)}">${escapeHtml(statusText)}</span>${unread ? `<span class="support-unread">${escapeHtml(tr('unread'))}</span>` : ''}<span class="support-open-conversation">${escapeHtml(tr('openConversation'))} →</span></div>
      </a>`;
    }).join('');
  }
  async function refreshForSession(nextSession) {
    session = nextSession;
    setGate(Boolean(session));
    if (!session) return;
    try {
      if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_banned').eq('id', session.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.is_banned) {
        setGate(false);
        showMessage(tr('loginRequired'), 'error');
        return;
      }
      const { data: isStaff } = await supabase.rpc('support_is_staff');
      $('#supportStaffNav').hidden = !isStaff;
      await loadCategories();
      await loadTickets();
    } catch (error) {
      console.error('Support center initialization:', error);
      $('#supportTickets').innerHTML = `<div class="support-empty">${escapeHtml(tr('ticketsError'))}</div>`;
      const select = $('#supportCategory');
      select.innerHTML = `<option value="">${escapeHtml(tr('categoriesError'))}</option>`;
      showMessage(tr('categoriesError'), 'error');
    }
  }
  function selectedFiles() { return Array.from($('#supportAttachments').files || []); }
  function validFile(file) {
    const name = file.name || '';
    const extension = name.split('.').pop().toLowerCase();
    const expectedType = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'pdf' ? 'application/pdf' : '';
    return Boolean(expectedType && expectedType === file.type && ['jpg', 'jpeg', 'png', 'pdf'].includes(extension));
  }
  function renderFiles() {
    const files = selectedFiles();
    $('#supportFileList').innerHTML = files.map((file, index) => `<li><span>${escapeHtml(file.name)} · ${(file.size / 1024 / 1024).toFixed(2)} MB</span><button type="button" data-remove-file="${index}" aria-label="${escapeHtml(tr('attachmentRemoved'))}">×</button></li>`).join('');
    $('#supportFileList').querySelectorAll('[data-remove-file]').forEach((button) => button.addEventListener('click', () => {
      const transfer = new DataTransfer();
      files.forEach((file, index) => { if (index !== Number(button.dataset.removeFile)) transfer.items.add(file); });
      $('#supportAttachments').files = transfer.files;
      renderFiles();
    }));
  }
  function draftFingerprint(files) {
    return JSON.stringify({ category: $('#supportCategory').value, subcategory: $('#supportSubcategory').value, order: $('#supportOrderId').value.trim(), subject: $('#supportSubject').value.trim(), message: $('#supportMessage').value.trim(), files: files.map((file) => [file.name, file.size, file.lastModified]) });
  }
  async function uploadAttachments(ticketId, messageId, files, idempotencyKey) {
    for (let index = 0; index < files.length; index++) {
      const file = files[index];
      const extension = file.name.split('.').pop().toLowerCase();
      const path = `${ticketId}/${idempotencyKey}/${index}.${extension}`;
      const { data: existing, error: existingError } = await supabase.from('support_attachments')
        .select('id').eq('file_path', path).maybeSingle();
      if (existingError) throw existingError;
      if (existing) continue;
      const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file, {
        cacheControl: '3600', contentType: file.type, upsert: false
      });
      if (uploadError && !/already exists|duplicate/i.test(uploadError.message || '')) throw uploadError;
      const { error: rowError } = await supabase.from('support_attachments').insert({
        ticket_id: ticketId, message_id: messageId, uploaded_by: session.user.id,
        file_name: file.name, file_path: path, file_type: file.type, file_size: file.size
      });
      if (rowError) throw rowError;
    }
  }

  $('#supportLogin').addEventListener('click', openAuthDialog);
  $('#supportAuthDialog').addEventListener('click', (event) => { if (event.target.id === 'supportAuthDialog' || event.target.closest('[data-support-close]')) closeAuthDialog(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAuthDialog(); });
  $('#supportAuthForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const identifier = $('#supportAuthIdentifier').value.trim();
    const password = $('#supportAuthPassword').value;
    const button = $('#supportAuthSubmit');
    const message = $('#supportAuthMessage');
    message.textContent = tr('loggingIn');
    button.disabled = true;
    try {
      let email = identifier;
      if (!identifier.includes('@')) {
        const { data: resolvedEmail, error: lookupError } = await supabase.rpc('get_login_email_by_username', { p_username: identifier });
        if (lookupError) throw lookupError;
        if (!resolvedEmail) throw new Error('invalid_credentials');
        email = resolvedEmail;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      message.textContent = '';
      $('#supportAuthPassword').value = '';
      closeAuthDialog();
    } catch (error) {
      console.error('Support sign-in:', error);
      message.textContent = tr('authError');
    } finally {
      button.disabled = false;
    }
  });
  $('#supportCategory').addEventListener('change', renderSubcategories);
  $('#supportMessage').addEventListener('input', () => { $('#supportMessageCount').textContent = String($('#supportMessage').value.length); });
  $('#supportAttachments').addEventListener('change', () => { showMessage(); renderFiles(); });
  $('#supportRefresh').addEventListener('click', loadTickets);
  window.addEventListener('7sabatk:language-changed', (event) => applyLanguage(event.detail?.language));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showMessage();
    if (!session) { showMessage(tr('loginRequired'), 'error'); $('#authOpen')?.click(); return; }
    const files = selectedFiles();
    const categoryId = Number($('#supportCategory').value);
    const subcategoryId = $('#supportSubcategory').value ? Number($('#supportSubcategory').value) : null;
    const subject = $('#supportSubject').value.trim();
    const message = $('#supportMessage').value.trim();
    if (!categoryId) { showMessage(tr('selectCategory'), 'error'); $('#supportCategory').focus(); return; }
    if (subject.length < 3) { showMessage(tr('subjectRequired'), 'error'); $('#supportSubject').focus(); return; }
    if (!message) { showMessage(tr('messageRequired'), 'error'); $('#supportMessage').focus(); return; }
    if (files.length > 5) { showMessage(tr('tooManyFiles'), 'error'); return; }
    if (files.some((file) => !validFile(file))) { showMessage(tr('invalidFile'), 'error'); return; }
    if (files.some((file) => file.size <= 0 || file.size > 5 * 1024 * 1024)) { showMessage(tr('fileTooLarge'), 'error'); return; }
    if (files.some((file) => file.name.length > 255 || /[\\/]/.test(file.name))) { showMessage(tr('invalidFileName'), 'error'); return; }

    const currentFingerprint = draftFingerprint(files);
    if (!requestKey || requestFingerprint !== currentFingerprint) {
      requestKey = crypto.randomUUID();
      requestFingerprint = currentFingerprint;
    }
    const idempotencyKey = requestKey;
    const button = $('#supportSubmit');
    button.disabled = true;
    showMessage(tr('sending'));
    let createdTicketNumber = null;
    try {
      const { data: result, error } = await supabase.rpc('support_create_ticket', {
        p_category_id: categoryId,
        p_subcategory_id: subcategoryId,
        p_order_id: $('#supportOrderId').value.trim() || null,
        p_subject: subject,
        p_message: message,
        p_client_request_id: idempotencyKey
      });
      if (error) throw error;
      const ticket = Array.isArray(result) ? result[0] : result;
      if (!ticket?.out_ticket_id || !ticket?.out_message_id || !ticket?.out_ticket_number) throw new Error('Ticket response was incomplete');
      createdTicketNumber = ticket.out_ticket_number;
      if (files.length) await uploadAttachments(ticket.out_ticket_id, ticket.out_message_id, files, idempotencyKey);
      showMessage(`${tr('ticketCreated')}${ticket.out_ticket_number}`, 'success');
      form.reset();
      $('#supportMessageCount').textContent = '0';
      renderFiles();
      $('#supportSubcategory').disabled = true;
      $('#supportSubcategory').innerHTML = `<option value="">${tr('subcategoryOptional')}</option>`;
      requestKey = null;
      requestFingerprint = '';
      await loadTickets();
    } catch (error) {
      console.error('Support ticket submission:', error);
      showMessage(createdTicketNumber ? `${tr('ticketCreated')}${createdTicketNumber}${tr('partialFiles')}` : (error?.message && /message_required|invalid_category|invalid_subcategory|account_not_allowed/.test(error.message) ? error.message : tr('submitError')), createdTicketNumber ? 'error' : 'error');
      if (createdTicketNumber) await loadTickets();
    } finally {
      button.disabled = false;
    }
  });

  applyTheme(getPreferences().theme);
  $('#supportYear').textContent = new Date().getFullYear();
  applyLanguage();
  if (!isSupabaseConfigured || !supabase) {
    setGate(false);
    showMessage(tr('categoriesError'), 'error');
  } else {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    await refreshForSession(currentSession);
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      setTimeout(() => refreshForSession(nextSession), 0);
    });
  }
}
