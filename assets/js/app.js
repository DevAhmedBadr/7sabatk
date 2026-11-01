import { supabase, isSupabaseConfigured } from "./backend.js";
import { translations } from "./site-copy.js";
import { loadAccounts, loadPublicSettings } from "./data.js";
import { renderAccounts, showAccountDetails, openDialog, closeDialog } from "./render.js";
import { getPreferences, savePreferences, applyTheme, getCurrencyRates, resolveLanguage, resolveNumberLocale } from "./preferences.js";
const $ = s => document.querySelector(s);
const OWNER_ADMIN_ID = "be398df3-3918-46e1-abc4-59975ffe716b";
const grid = $("#accountGrid"), search = $("#searchInput"), category = $("#categoryFilter"), sort = $("#sortFilter"), count = $("#resultsCount"), empty = $("#emptyState");
let textOverrides = { ar: {}, en: {} };
let accounts = [], preferences = getPreferences(), rates = {
    KWD: 1
}, publicSettings = {}, fieldDefinitions = [], fieldPlatformStates = [], session = null, profile = null, language = resolveLanguage(preferences.language), numberLocale = resolveNumberLocale(preferences.numberLocale, language);
function t(k) {
    if (k === "brand" && publicSettings.site_name) return publicSettings.site_name;
    return textOverrides?.[language]?.[k] ?? translations[language][k] ?? k;
}

function dynamicTextPath(node,root){
 const parts=[];let el=node.nodeType===Node.TEXT_NODE?node.parentElement:node;
 while(el&&el!==root){
  const parent=el.parentElement;if(!parent)break;
  const same=[...parent.children].filter(x=>x.tagName===el.tagName);
  parts.unshift(`${el.tagName.toLowerCase()}:`+same.indexOf(el));el=parent;
 }
 return parts.join('>');
}
function applyDynamicHtmlTexts(){
 const saved=publicSettings.site_html_texts;
 if(!saved||typeof saved!=='object')return;
 const root=document.body;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode())){
  if(!node.parentElement||node.parentElement.closest('script,style,noscript,template,svg,code,pre'))continue;
  const index=[...node.parentElement.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).indexOf(node);
  const key=dynamicTextPath(node,root)+`::text:${index}`;
  const entry=saved[key],value=entry?.[language];
  if(typeof value==='string'&&value.trim())node.nodeValue=node.nodeValue.replace(node.nodeValue.trim(),value);
 }
 document.querySelectorAll('input,textarea,button,a,[title],[aria-label],[placeholder],[alt]').forEach(el=>{
  ['placeholder','title','aria-label','alt'].forEach(attr=>{
   const key=dynamicTextPath(el,root)+`::attr:${attr}`;
   const value=saved[key]?.[language];if(typeof value==='string'&&value.trim())el.setAttribute(attr,value);
  });
 });
}
function applyLanguage() {
    const globalLanguage = publicSettings.default_language;
    language = resolveLanguage(globalLanguage === "ar" || globalLanguage === "en" ? globalLanguage : preferences.language);
    const languageControl = $("#languageSelect");
    if (languageControl) {
        languageControl.disabled = globalLanguage === "ar" || globalLanguage === "en";
        languageControl.value = languageControl.disabled ? globalLanguage : preferences.language;
    }
    numberLocale = resolveNumberLocale(preferences.numberLocale, language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.title = language === "ar" ? "موقع حساباتك | بيع الحسابات الرقمية" : "7sabatk | Digital Accounts Marketplace";
    const set = (sel, key) => {
        const el = $(sel);
        if (el)
            el.textContent = t(key);
    };
    set('.nav-links a[href="#home"]', 'home');
    set('.nav-links a[href="#marketplace"]', 'catalog');
    set('.nav-links a[href="#about"]', 'about');
    set('.nav-links a[href="#contact"]', 'contact');
    set('#authOpen', 'login');
    $('#accountOpen').setAttribute('aria-label', t('account'));
    const brand = $$("[data-brand-name]");
    brand.forEach(el => el.textContent = t('brand'));
    set('.hero .eyebrow', 'heroKicker');
    const h = $('.hero-copy h1');
    h.innerHTML = `${t('hero1')}<br><span>${t('hero2')}</span>`;
    set('.hero-copy>p', 'heroText');
    $('.hero-actions a.button').textContent = t('browse');
    $('.hero-actions a.button-ghost').textContent = t('more');
    const f = $('.features-section .section-heading');
    f.querySelector('.section-kicker').textContent = t('featuresKicker');
    f.querySelector('h2').textContent = t('featuresTitle');
    f.querySelector('p').textContent = t('featuresText');
    const cards = $$('.feature-card');
    [['f1', 'f1p'], ['f2', 'f2p'], ['f3', 'f3p']].forEach((keys, i) => {
        cards[i].querySelector('h3').textContent = t(keys[0]);
        cards[i].querySelector('p').textContent = t(keys[1]);
    });
    const mh = $('.marketplace-section .section-heading');
    mh.querySelector('.section-kicker').textContent = t('catalogKicker');
    mh.querySelector('h2').textContent = t('catalogTitle');
    mh.querySelector('p').textContent = t('catalogText');
    search.placeholder = t('search');
    category.options[0].textContent = t('all');
    sort.options[0].textContent = t('newest');
    sort.options[1].textContent = t('low');
    sort.options[2].textContent = t('high');
    sort.options[3].textContent = t('followersSort');
    const about = $('.about-section');
    about.querySelector('.section-kicker').textContent = t('aboutKicker');
    about.querySelector('h2').innerHTML = `<span>${t('brand')}</span><br><span>${t('aboutTitle')}</span>`;
    about.querySelector('.about-copy p').textContent = t('aboutText');
    const contact = $('.contact-panel');
    contact.querySelector('h2').textContent = t('contactTitle');
    contact.querySelector('p').textContent = t('contactText');
    contact.querySelector('a').textContent = t('contactBtn');
    $('.footer-inner>span').lastChild.textContent = ' ' + t('footer');
    $('#authTitle').textContent = authMode === 'login' ? t('authLogin') : t('authSignup');
    $('#authSubtitle').textContent = authMode === 'login' ? t('welcome') : t('signupWelcome');
    $('#authSubmit').textContent = authMode === 'login' ? t('enter') : t('create');
    $('#authIdentifierLabel').childNodes[0].textContent = authMode === 'login' ? t('loginIdentifier') : t('email');
    $('#authUsernameLabel').childNodes[0].textContent = t('username');
    $('#authPasswordLabel').childNodes[0].textContent = t('password');
    $('#authConfirmPasswordLabel').childNodes[0].textContent = t('confirmPassword');
    $('#settingsOpen').title = t('language');
    $('#settingsOpen').setAttribute('aria-label', t('language'));
    $('#languageSettingLabel').childNodes[0].textContent = t('language');
    $('#currencySettingLabel').childNodes[0].textContent = t('currency');
    $('#themeSettingLabel').childNodes[0].textContent = t('theme');
    $('#numberSettingLabel').childNodes[0].textContent = t('numbers');
    $('#motionLabel').textContent = t('motion');
    $('#motionSub').textContent = t('motionSub');
    $('#compactLabel').textContent = t('compact');
    $('#compactSub').textContent = t('compactSub');
    $('#referenceLabel').textContent = t('reference');
    $('#referenceSub').textContent = t('referenceSub');
    $('#imageFit').previousSibling.textContent = t('imageFit');
    $('#imageFit option[value=contain]').textContent = t('imageContain');
    $('#imageFit option[value=cover]').textContent = t('imageCover');
    $('#savePreferences').textContent = t('save');
    $('#themeSelect option[value=dark]').textContent = language === 'ar' ? 'داكن' : 'Dark';
    $('#themeSelect option[value=light]').textContent = language === 'ar' ? 'فاتح' : 'Light';
    $('#themeSelect option[value=system]').textContent = language === 'ar' ? 'حسب الجهاز' : 'System';
    $('#languageSelect option[value=auto]').textContent = t('auto');
    $('#numberLocale option[value=ar]').textContent = language === 'ar' ? 'العربية' : 'Arabic';
    $('#numberLocale option[value=en]').textContent = language === 'ar' ? 'الإنجليزية' : 'English';
    $('#currencySelect option[value=KWD]').textContent = language === 'ar' ? 'الدينار الكويتي (KWD)' : 'Kuwaiti dinar (KWD)';
    $('#currencySelect option[value=USD]').textContent = language === 'ar' ? 'الدولار الأمريكي (USD)' : 'US dollar (USD)';
    $('#currencySelect option[value=EUR]').textContent = language === 'ar' ? 'اليورو (EUR)' : 'Euro (EUR)';
    $('#currencySelect option[value=SAR]').textContent = language === 'ar' ? 'الريال السعودي (SAR)' : 'Saudi riyal (SAR)';
    $('#currencySelect option[value=EGP]').textContent = language === 'ar' ? 'الجنيه المصري (EGP)' : 'Egyptian pound (EGP)';
    $$('[data-auth-tab="login"]')[0].textContent = t('authLogin');
    $$('[data-auth-tab="signup"]')[0].textContent = t('authSignup');
    $('#adminShortcut').textContent = t('admin');
    $('#signOut').textContent = t('logout');
    $('#profileNameLabel').childNodes[0].textContent = t('fullName');
    $('#profileUsernameLabel').childNodes[0].textContent = t('username');
    $('#profileEmailLabel').childNodes[0].textContent = t('email');
    $('#settingsDialog .dialog-heading h2').textContent = language === 'ar' ? 'إعدادات الموقع' : 'Website settings';
    $('#settingsDialog .dialog-heading p').textContent = language === 'ar' ? 'خصص طريقة عرض الموقع حسب تفضيلاتك.' : 'Customize the storefront to your preferences.';
    $('#profileDialog .dialog-heading h2').textContent = t('profile');
    $('#accountDialog #detailContact').textContent = t('ask');
    $('.hero-card-top span').textContent = t('brand');
    $('#passwordReset').textContent = t('passwordReset');
    $('#forgotPassword').textContent = language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot password?';
    $('#profileForm button').textContent = t('saveProfile');
    $('#profileAvatarButton').textContent = language === 'ar' ? 'تغيير الصورة الشخصية' : 'Change profile photo';
    $('#authPrivacyNote').textContent = language === 'ar' ? 'لن نطلب منك كلمة مرور أي منصة خارجية. بيانات الدخول هنا تخص حسابك في الموقع فقط.' : 'We never ask for passwords for external platforms. These credentials are only for your 7sabatk account.';
    $('#profilePrivacyNote').textContent = language === 'ar' ? 'تغيير البريد يتطلب تأكيد البريد الجديد. لا تشارك كلمة مرور حسابك أو رموز التحقق مع أي شخص.' : 'Changing your email requires confirmation. Never share your password or verification codes.';
    $('#passwordDialogTitle').textContent = language === 'ar' ? 'تغيير كلمة المرور' : 'Change password';
    $('#passwordDialogSubtitle').textContent = language === 'ar' ? 'أدخل رمز التحقق المرسل إلى بريدك الإلكتروني.' : 'Enter the verification code sent to your email.';
    $('#passwordOtpLabel').childNodes[0].textContent = 'OTP';
    $('#verifyOtpButton').textContent = language === 'ar' ? 'التحقق من الرمز' : 'Verify code';
    $('#newPasswordLabel').childNodes[0].textContent = language === 'ar' ? 'كلمة المرور الجديدة' : 'New password';
    $('#updatePasswordButton').textContent = language === 'ar' ? 'تحديث كلمة المرور' : 'Update password';
    $('#emptyState h3').textContent = t('noResults');
    $('#emptyState p').textContent = t('noResultsText');
    applyDynamicHtmlTexts();
}
const $$ = s => [...document.querySelectorAll(s)];
function applySiteSettings() {
    const announcement = language === "en"
        ? (publicSettings.announcement_text_en || publicSettings.announcement_text || "")
        : (publicSettings.announcement_text_ar || publicSettings.announcement_text || "");
    const announcementBar = $("#announcement");
    if (announcementBar) {
        const enabled = publicSettings.announcement_enabled === true || publicSettings.announcement_enabled === "true";
        const link = String(publicSettings.announcement_link || "").trim();
        announcementBar.textContent = announcement;
        announcementBar.hidden = !(announcement && enabled);
        announcementBar.setAttribute("role", "status");
        announcementBar.setAttribute("aria-live", "polite");
        announcementBar.dataset.style = publicSettings.announcement_style || "teal";
        if (link) {\n            try {\n                const parsedLink = new URL(link, window.location.href);\n                if (!["http:", "https:"].includes(parsedLink.protocol)) throw new Error("Invalid announcement URL");\n                announcementBar.href = parsedLink.href;\n                announcementBar.target = "_blank";\n                announcementBar.rel = "noopener noreferrer";\n                announcementBar.setAttribute("aria-label", announcement);\n            } catch {\n                announcementBar.removeAttribute("href");\n                announcementBar.removeAttribute("target");\n                announcementBar.removeAttribute("rel");\n            }\n        }
    }
    if (publicSettings.maintenance_mode === true) {
        $('#marketplace .container').innerHTML = `<div class="section-heading"><h2>${language === 'ar' ? 'المتجر تحت الصيانة' : 'Store maintenance'}</h2></div>`;
    }
    const contact = $('#contactLink');
    if (publicSettings.whatsapp_number) {
        contact.href = `https://wa.me/${publicSettings.whatsapp_number}`;
        contact.target = '_blank';
        contact.rel = 'noopener';
    } else if (publicSettings.contact_email)
        contact.href = `mailto:${publicSettings.contact_email}`;
}
function fillCategories() {
    const first = category.options[0];
    category.innerHTML = '';
    category.append(first);
    [...new Set(accounts.map(a => a.category).filter(Boolean))].sort().forEach(value => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = value;
        category.append(o);
    });
}
function filter() {
    const q = search.value.trim().toLocaleLowerCase(language),
    c = category.value;
    let list = accounts.filter(a => (publicSettings.show_unavailable !== false || a.is_available !== false) && [a.title, a.name, a.username, a.category, a.reference, a.id].join(' ').toLocaleLowerCase(language).includes(q) && (c === 'all' || a.category === c));
    if (sort.value === 'followers')
        list.sort((a, b) => (b.followers_count ?? b.followers ?? 0) - (a.followers_count ?? a.followers ?? 0));
    if (sort.value === 'priceAsc')
        list.sort((a, b) => (a.price_kwd ?? a.price ?? Infinity) - (b.price_kwd ?? b.price ?? Infinity));
    if (sort.value === 'priceDesc')
        list.sort((a, b) => (b.price_kwd ?? b.price ?? 0) - (a.price_kwd ?? a.price ?? 0));
    if (sort.value === 'newest')
        list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    renderAccounts(list, grid, a => showAccountDetails(a, $('#accountDialog'), {
            ...preferences,
            numberLocale
        }, rates, publicSettings, fieldDefinitions, language, fieldPlatformStates), {
        ...preferences,
        numberLocale
    }, rates, fieldDefinitions, language, fieldPlatformStates);
    count.textContent = language === 'ar' ? `عدد النتائج: ${new Intl.NumberFormat(numberLocale).format(list.length)}` : `Results: ${new Intl.NumberFormat(numberLocale).format(list.length)}`;
    empty.hidden = list.length > 0;
}
[search, category, sort].forEach(el => el.addEventListener('input', filter));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog(b.dataset.close)));
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => {
        if (e.target === o)
            closeDialog(o.id);
    }));
document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
        document.querySelectorAll('.overlay.open').forEach(el => closeDialog(el.id));
});
$('#settingsOpen').addEventListener('click', () => {
    $('#currencySelect').value = preferences.currency;
    $('#themeSelect').value = preferences.theme;
    $('#numberLocale').value = preferences.numberLocale;
    $('#languageSelect').value = (publicSettings.default_language === "ar" || publicSettings.default_language === "en")
        ? publicSettings.default_language : preferences.language;
    $('#languageSelect').disabled = publicSettings.default_language === "ar" || publicSettings.default_language === "en";
    $('#reduceMotion').checked = preferences.reduceMotion;
    $('#compactCards').checked = preferences.compactCards;
    $('#showReference').checked = preferences.showReference;
    $('#imageFit').value = preferences.imageFit;
    openDialog('settingsDialog');
});
$('#savePreferences').addEventListener('click', async() => {
    preferences = {
        ...preferences,
        currency: $('#currencySelect').value,
        theme: $('#themeSelect').value,
        numberLocale: $('#numberLocale').value,
        language: (publicSettings.default_language === "ar" || publicSettings.default_language === "en")
            ? publicSettings.default_language : $('#languageSelect').value,
        reduceMotion: $('#reduceMotion').checked,
        compactCards: $('#compactCards').checked,
        showReference: $('#showReference').checked,
        imageFit: $('#imageFit').value
    };
    savePreferences(preferences);
    applyTheme(preferences.theme);
    document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion);
    document.documentElement.classList.toggle('compact-cards', preferences.compactCards);
    document.documentElement.dataset.imageFit = preferences.imageFit;
    applyLanguage();
    rates = await getCurrencyRates();
    filter();
    $('#settingsMessage').textContent = language === 'ar' ? 'تم حفظ تفضيلاتك.' : 'Preferences saved.';
});
let authMode = 'login', pendingRecoveryEmail = '';
function setAuthMode(mode) {
    authMode = mode;
    $$('[data-auth-tab]').forEach(b => b.classList.toggle('active', b.dataset.authTab === mode));
    $('#authTitle').textContent = mode === 'login' ? t('authLogin') : t('authSignup');
    $('#authSubtitle').textContent = mode === 'login' ? t('welcome') : t('signupWelcome');
    $('#authSubmit').textContent = mode === 'login' ? t('enter') : t('create');
    $('#authMessage').textContent = '';
    $('#authIdentifierLabel').childNodes[0].textContent = mode === 'login' ? t('loginIdentifier') : t('email');
    $('#authIdentifierLabel input').type = mode === 'login' ? 'text' : 'email';
    $('#authIdentifierLabel input').placeholder = mode === 'login' ? 'name@example.com أو username' : 'name@example.com';
    $('#authUsernameLabel').hidden = mode !== 'signup';
    $('#authConfirmPasswordLabel').hidden = mode !== 'signup';
    $('#authForm [name=password]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('#authForm [name=confirmPassword]').required = mode === 'signup';
    $('#authForm [name=username]').required = mode === 'signup';
    $('#authForm [name=email]').autocomplete = mode === 'login' ? 'username' : 'email';
}
$$('[data-auth-tab]').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.authTab)));
$('#authOpen').addEventListener('click', () => {
    setAuthMode('login');
    openDialog('authDialog');
});
$('#authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const identifier = String(fd.get('email') || '').trim();
    const email = identifier;
    const username = String(fd.get('username') || '').trim();
    const password = String(fd.get('password') || '');
    const confirmPassword = String(fd.get('confirmPassword') || '');
    const msg = $('#authMessage');
    if (!isSupabaseConfigured) {
        msg.textContent = 'Supabase is not configured.';
        return;
    }
    if (authMode === 'signup') {
        if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
            msg.textContent = t('usernameInvalid');
            $('#authForm [name=username]').focus();
            return;
        }
        if (password !== confirmPassword) {
            msg.textContent = t('passwordMismatch');
            $('#authForm [name=confirmPassword]').focus();
            return;
        }
    }
    $('#authSubmit').disabled = true;
    msg.textContent = language === 'ar' ? 'جارٍ تنفيذ الطلب...' : 'Please wait...';
    try {
        if (authMode === 'signup') {
            const { data: available, error: availabilityError } = await supabase.rpc('is_username_available', {
                p_username: username
            });
            if (availabilityError)
                throw new Error(language === 'ar' ? 'تعذر التحقق من اسم المستخدم. تأكد من تطبيق تحديث قاعدة البيانات.' : availabilityError.message);
            if (available !== true) {
                msg.textContent = t('usernameTaken');
                $('#authForm [name=username]').focus();
                return;
            }
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: 'https://devahmedbadr.github.io/7sabatk/',
                    data: {
                        username
                    }
                }
            });
            if (error) {
                if (/profiles_username_unique|duplicate key|username/i.test(error.message)) {
                    msg.textContent = t('usernameTaken');
                    return;
                }
                throw error;
            }
            msg.textContent = data.session ? (language === 'ar' ? 'تم إنشاء الحساب.' : 'Account created.') : (language === 'ar' ? 'تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم ارجع إلى الموقع.' : 'Account created. Check your email to confirm, then return here.');
            if (data.session) {
                closeDialog('authDialog');
                await refreshAuth();
            }
        } else {
            let loginEmail = identifier;
            if (!identifier.includes('@')) {
                const { data: resolvedEmail, error: lookupError } = await supabase.rpc('get_login_email_by_username', {
                    p_username: identifier
                });
                if (lookupError)
                    throw new Error(language === 'ar' ? 'تعذر تسجيل الدخول باسم المستخدم. تأكد من تطبيق تحديث قاعدة البيانات.' : lookupError.message);
                if (!resolvedEmail)
                    throw new Error(language === 'ar' ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Invalid username or password.');
                loginEmail = resolvedEmail;
            }
            const { error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password
            });
            if (error)
                throw error;
            closeDialog('authDialog');
            await refreshAuth();
        }
    } catch (error) {
        msg.textContent = error.message || 'Authentication failed.';
    } finally {
        $('#authSubmit').disabled = false;
    }
});
$('#forgotPassword').addEventListener('click', async() => {
    const email = $('#authForm [name=email]').value.trim(),
    msg = $('#authMessage');
    if (!email || !email.includes('@')) {
        msg.textContent = language === 'ar' ? 'اكتب بريدك الإلكتروني أولًا (لاستعادة كلمة المرور).' : 'Enter your email address first.';
        $('#authForm [name=email]').focus();
        return;
    }
    msg.textContent = language === 'ar' ? 'جارٍ إرسال رمز الاستعادة...' : 'Sending recovery code...';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://devahmedbadr.github.io/7sabatk/'
    });
    if (error) {
        msg.textContent = error.message;
        return;
    }
    pendingRecoveryEmail = email;
    $('#passwordOtpForm').hidden = false;
    $('#passwordForm').hidden = true;
    $('#passwordOtp').value = '';
    msg.textContent = language === 'ar' ? 'تم إرسال رمز الاستعادة إلى بريدك.' : 'A recovery code was sent to your email.';
    openDialog('passwordDialog');
});
async function refreshAuth() {
    if (!isSupabaseConfigured)
        return;
    const { data: {
        session: s
    }
     } = await supabase.auth.getSession();
    session = s;
    $('#authOpen').hidden = !!session;
    $('#accountOpen').hidden = !session;
    $('#adminShortcut').hidden = true;
    if (!session) {
        profile = null;
        $('#accountAvatar').textContent = 'A';
        $('#accountAvatar').querySelector('img')?.remove();
        return;
    }
    const { data: p, error: profileError } = await supabase.from('profiles').select('role,full_name,username,email,avatar_url').eq('id', session.user.id).maybeSingle();
    profile = p || {};
    if (profileError)
        console.warn('Could not load profile details:', profileError.message);
    $('#profileEmail').textContent = session.user.email || '';
    $('#profileFullName').value = profile.full_name || '';
    $('#profileUsername').value = profile.username || '';
    $('#profileEmailEdit').value = session.user.email || profile.email || '';
    const initial = (profile.full_name || profile.username || session.user.email || 'U').trim().slice(0, 1).toUpperCase();
    $('#accountAvatar').textContent = initial;
    const avatarUrl = profile.avatar_url || '';
    const avatarPreview = $('#profileAvatarPreview'),
    fallback = $('#profileAvatarFallback');
    if (avatarUrl) {
        avatarPreview.src = avatarUrl;
        avatarPreview.hidden = false;
        fallback.hidden = true;
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarUrl;
        avatarImg.alt = '';
        $('#accountAvatar').replaceChildren(avatarImg);
    } else {
        avatarPreview.hidden = true;
        fallback.hidden = false;
        fallback.textContent = initial;
        $('#accountAvatar').textContent = initial;
    }
    // The dashboard page performs the real role + owner authorization check.
    // This only controls whether the owner sees the navigation shortcut.
    $('#adminShortcut').hidden = session.user.id !== OWNER_ADMIN_ID;
}
$('#accountOpen').addEventListener('click', () => openDialog('profileDialog'));
$('#adminShortcut').addEventListener('click', () => location.href = 'admin.html');
$('#signOut').addEventListener('click', async() => {
    await supabase.auth.signOut();
    closeDialog('profileDialog');
    await refreshAuth();
});
$('#profileForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!session) return;

    const msg = $('#profileMessage');
    const full_name = $('#profileFullName').value.trim();
    const username = $('#profileUsername').value.trim();
    const newEmail = $('#profileEmailEdit').value.trim();

    // Validate username format
    if (username && !/^[A-Za-z0-9_]{3,30}$/.test(username)) {
        msg.textContent = language === 'ar'
            ? 'اسم المستخدم يجب أن يكون من 3 إلى 30 حرفًا إنجليزيًا أو رقمًا أو _.'
            : 'Username must be 3–30 letters, numbers or underscores.';
        return;
    }

    msg.textContent = language === 'ar'
        ? 'جارٍ الحفظ...'
        : 'Saving...';

    try {
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name,
                username: username || null
            })
            .eq('id', session.user.id);

        if (error) throw error;

        if (newEmail && newEmail !== session.user.email) {
            const { error: emailError } = await supabase.auth.updateUser({
                email: newEmail
            });

            if (emailError) throw emailError;

            msg.textContent = language === 'ar'
                ? 'تم حفظ الاسم. أرسلنا رسالة تأكيد إلى البريد الجديد.'
                : 'Profile saved. A confirmation email was sent to the new address.';
        } else {
            msg.textContent = language === 'ar'
                ? 'تم حفظ بيانات الحساب.'
                : 'Account details saved.';
        }

        await refreshAuth();

    } catch (err) {
        const duplicateUsername =
            err?.code === '23505' ||
            /profiles_username_(?:key|unique)|duplicate key value.*username/i.test(
                String(err?.message || '')
            );

        if (duplicateUsername) {
            msg.textContent = language === 'ar'
                ? 'اسم المستخدم مستخدم بالفعل. يرجى اختيار اسم مستخدم اخر.'
                : 'This username is already taken. Please choose another one.';

            $('#profileUsername').focus();
            $('#profileUsername').select();

        } else {
            msg.textContent = err?.message ||
                (language === 'ar'
                    ? 'تعذر حفظ بيانات الحساب. حاول مرة أخرى.'
                    : 'Could not save profile. Please try again.');
        }
    }
});
$('#passwordOtpForm').addEventListener('submit', async e => {
    e.preventDefault();
    const token = $('#passwordOtp').value.trim(),
    email = pendingRecoveryEmail || session?.user?.email || $('#profileEmailEdit').value.trim();
    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'recovery'
    });
    if (!error) {
        session = data.session || session;
    }
    $('#otpMessage').textContent = error ? error.message : (language === 'ar' ? 'تم التحقق. أدخل كلمة المرور الجديدة.' : 'Verified. Enter your new password.');
    if (!error) {
        $('#passwordOtpForm').hidden = true;
        $('#passwordForm').hidden = false;
    }
});
$('#passwordForm').addEventListener('submit', async e => {
    e.preventDefault();
    const password = $('#newPassword').value;
    if (password.length < 8) {
        $('#passwordMessage').textContent = language === 'ar' ? 'استخدم 8 أحرف على الأقل.' : 'Use at least 8 characters.';
        return;
    }
    const { error } = await supabase.auth.updateUser({
        password
    });
    $('#passwordMessage').textContent = error ? error.message : (language === 'ar' ? 'تم تحديث كلمة المرور بنجاح.' : 'Password updated successfully.');
    if (!error)
        setTimeout(() => closeDialog('passwordDialog'), 1200);
});
$('#passwordReset').addEventListener('click', async() => {
    if (!session?.user?.email)
        return;
    pendingRecoveryEmail = session.user.email;
    const { error } = await supabase.auth.resetPasswordForEmail(session.user.email, {
        redirectTo: 'https://devahmedbadr.github.io/7sabatk/'
    });
    $('#profileMessage').textContent = error ? error.message : (language === 'ar' ? 'تم إرسال رمز تغيير كلمة المرور إلى بريدك.' : 'Password reset code sent to your email.');
    if (!error) {
        $('#passwordOtpForm').hidden = false;
        $('#passwordForm').hidden = true;
        $('#passwordOtp').value = '';
        openDialog('passwordDialog');
    }
});

$('#profileAvatarFile').addEventListener('change', async e => {
    const file = e.currentTarget.files?.[0];
    if (!file || !session)
        return;
    const msg = $('#profileMessage');
    if (file.size > 3 * 1024 * 1024) {
        msg.textContent = language === 'ar' ? 'حجم الصورة يجب ألا يتجاوز 3 ميجابايت.' : 'Image must be 3 MB or smaller.';
        e.currentTarget.value = '';
        return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        msg.textContent = language === 'ar' ? 'استخدم صورة JPG أو PNG أو WEBP.' : 'Use a JPG, PNG or WEBP image.';
        e.currentTarget.value = '';
        return;
    }
    msg.textContent = language === 'ar' ? 'جارٍ رفع الصورة...' : 'Uploading image...';
    try {
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1],
        path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, {
            upsert: true,
            contentType: file.type
        });
        if (uploadError)
            throw uploadError;
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        const { error: updateError } = await supabase.from('profiles').update({
            avatar_url: data.publicUrl
        }).eq('id', session.user.id);
        if (updateError)
            throw updateError;
        msg.textContent = language === 'ar' ? 'تم تحديث الصورة الشخصية.' : 'Profile photo updated.';
        await refreshAuth();
    } catch (err) {
        msg.textContent = err.message || 'Could not upload image.';
    }
    e.currentTarget.value = '';
});

$('#lightboxClose').addEventListener('click', () => {
    $('#imageLightbox').classList.remove('open');
    $('#imageLightbox').setAttribute('aria-hidden', 'true');
});
$('#imageLightbox').addEventListener('click', e => {
    if (e.target.id === 'imageLightbox') {
        $('#imageLightbox').classList.remove('open');
        $('#imageLightbox').setAttribute('aria-hidden', 'true');
    }
});

async function boot() {
    applyTheme(preferences.theme);
    document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion);
    document.documentElement.classList.toggle('compact-cards', preferences.compactCards);
    document.documentElement.dataset.imageFit = preferences.imageFit;
    $('#year').textContent = new Date().getFullYear();
    $('#languageSelect').value = preferences.language;
    $('#numberLocale').value = preferences.numberLocale;
    applyLanguage();
    try {
        rates = await getCurrencyRates();
        publicSettings = await loadPublicSettings();
        textOverrides = {
            ar: publicSettings.site_text_ar && typeof publicSettings.site_text_ar === "object" ? publicSettings.site_text_ar : {},
            en: publicSettings.site_text_en && typeof publicSettings.site_text_en === "object" ? publicSettings.site_text_en : {}
        };
        applyLanguage();
        if (!localStorage.getItem('7sabatk_preferences_v3') && ['KWD', 'USD', 'EUR', 'SAR', 'EGP'].includes(publicSettings.default_currency)) {
            preferences.currency = publicSettings.default_currency;
            savePreferences(preferences);
        }
        applySiteSettings();
        accounts = await loadAccounts();
        try {
            const [{
                    data: fields,
                    error: fieldsError
                }, {
                    data: states,
                    error: statesError
                }
            ] = await Promise.all([
                        supabase.from('listing_fields').select('id,field_key,label_ar,label_en,is_active,sort_order,platform_key').order('sort_order'),
                        supabase.from('listing_field_platforms').select('field_id,platform_key,is_active')
                    ]);
            if (fieldsError)
                throw fieldsError;
            if (statesError)
                throw statesError;
            fieldDefinitions = fields || [];
            fieldPlatformStates = states || [];
        } catch (error) {
            console.warn('Could not load platform-specific field settings:', error.message);
            fieldDefinitions = [];
            fieldPlatformStates = [];
        }
        fillCategories();
        filter();
    } catch (error) {
        console.error(error);
        count.textContent = language === 'ar' ? 'تعذر تحميل البيانات' : 'Could not load data';
        empty.hidden = false;
        empty.querySelector('h3').textContent = language === 'ar' ? 'حدث خطأ أثناء تحميل الحسابات' : 'Error loading accounts';
        empty.querySelector('p').textContent = error.message || '';
    }
    if (isSupabaseConfigured) {
        await refreshAuth();
        supabase.auth.onAuthStateChange((event) => {
            setTimeout(refreshAuth, 0);
            if (event === 'PASSWORD_RECOVERY') {
                $('#passwordOtpForm').hidden = true;
                $('#passwordForm').hidden = false;
                openDialog('passwordDialog');
            }
        });
    }
}
boot();
