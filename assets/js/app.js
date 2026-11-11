import { supabase, isSupabaseConfigured } from "./backend.js";
import { translations } from "./site-copy.js";
import { loadAccounts, loadSubscriptions, loadPublicSettings } from "./data.js";
import { renderAccounts, renderSubscriptions, showAccountDetails, openDialog, closeDialog } from "./render.js";
import { getPreferences, savePreferences, applyTheme, getCurrencyRates, resolveLanguage, resolveNumberLocale } from "./preferences.js";
import { applySiteHeader } from "./site-language.js";
const $ = s => document.querySelector(s);
const OWNER_ADMIN_ID = "be398df3-3918-46e1-abc4-59975ffe716b";
const grid = $("#accountGrid"), search = $("#searchInput"), category = $("#categoryFilter"), sort = $("#sortFilter"), count = $("#resultsCount"), empty = $("#emptyState");
const subscriptionSearch = $("#subscriptionSearchInput"), subscriptionCategory = $("#subscriptionCategoryFilter"), subscriptionSort = $("#subscriptionSortFilter");
let textOverrides = { ar: {}, en: {} };
let accounts = [], subscriptions = [], preferences = getPreferences(), rates = {
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
  // Apply an override only when this is still the exact source text scanned
  // from index.html. This prevents stale DOM paths from changing unrelated
  // elements after the language script or dynamic rendering changes the DOM.
  const current=node.nodeValue.trim();
  if(typeof value==='string'&&value.trim()&&current===entry?.source){
   node.nodeValue=node.nodeValue.replace(current,value);
  }
 }
 document.querySelectorAll('input,textarea,button,a,[title],[aria-label],[placeholder],[alt]').forEach(el=>{
  ['placeholder','title','aria-label','alt'].forEach(attr=>{
   const key=dynamicTextPath(el,root)+`::attr:${attr}`;
   const entry=saved[key],value=entry?.[language];
   const current=(el.getAttribute(attr)||'').trim();
   if(typeof value==='string'&&value.trim()&&current===entry?.source)el.setAttribute(attr,value);
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
    const heroBanner = $('#heroBanner');
    if (heroBanner) { heroBanner.src = language === 'ar' ? 'assets/images/banner-ar.webp' : 'assets/images/banner-en.webp'; heroBanner.alt = language === 'ar' ? '7sabatk — منصة رقمية متكاملة' : '7sabatk — All-in-One Digital Platform'; }
    document.title = language === "ar" ? "موقع حساباتك | بيع الحسابات الرقمية" : "7sabatk | Digital Accounts Marketplace";
    const set = (sel, key) => {
        const el = $(sel);
        if (el)
            el.textContent = t(key);
    };
    set('.nav-links a[href="index.html"]', 'home');
    set('.nav-links a[href="accounts.html"]', 'catalog');
    set('.nav-links a[href="social-services.html"]', 'f2');
    set('.nav-links a[href="subscriptions.html"]', 'f3');
    const supportNav = $('#supportNav');
    if (supportNav) supportNav.textContent = language === 'ar' ? 'الدعم الفني' : 'Support';
    const footerSupportLink = $('#footerSupportLink');
    if (footerSupportLink) footerSupportLink.textContent = language === 'ar' ? 'الدعم الفني' : 'Support';
    set('#authOpen', 'login');
    $('#accountOpen').setAttribute('aria-label', t('account'));
    const brand = $$("[data-brand-name]");
    brand.forEach(el => el.textContent = t('brand'));
    applySiteHeader(language);
    set('.hero .eyebrow', 'heroKicker');
    const h = $('.hero-copy h1');
    h.innerHTML = `${t('hero1')}<br><span>${t('hero2')}</span>`;
    set('.hero-copy>p', 'heroText');
    $('.hero-actions a.button').textContent = t('browse');
    $('.hero-actions a.button').setAttribute('href', '#features');
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
    const featureHeading=$('.features-section .section-heading');
    if(featureHeading){
      featureHeading.querySelector('.section-kicker').textContent=language==='ar'?'خدماتنا الرقمية':'OUR DIGITAL SERVICES';
      featureHeading.querySelector('h2').textContent=language==='ar'?'اختر الخدمة التي تبحث عنها':'Choose the service you need';
      featureHeading.querySelector('p').textContent=language==='ar'?'اختر بين الحسابات الرقمية وخدمات السوشيال ميديا والاشتراكات الرقمية.':'Explore digital accounts, social media services and digital subscriptions.';
    }
    const serviceLabels = language === 'ar'
      ? [{title:'الحسابات الرقمية',text:'تصفح الحسابات الرقمية المعروضة للبيع.',href:'accounts.html'},{title:'خدمات السوشيال ميديا',text:'خدمات زيادة المتابعين واللايكات والمشاهدات. قريبًا',href:'social-services.html'},{title:'الاشتراكات الرقمية',text:'اشتراكات Netflix وYouTube وغيرها.',href:'subscriptions.html'}]
      : [{title:'Digital Accounts',text:'Browse digital accounts listed for sale.',href:'accounts.html'},{title:'Social Media Services',text:'Followers, likes and views services. Coming soon.',href:'social-services.html'},{title:'Digital Subscriptions',text:'Netflix, YouTube and other subscriptions.',href:'subscriptions.html'}];
    cards.forEach((card,i)=>{if(serviceLabels[i]){card.href=serviceLabels[i].href;card.querySelector('h3').textContent=serviceLabels[i].title;card.querySelector('p').textContent=serviceLabels[i].text;}});
    const socialTitle=$('[data-social-title]'), socialKicker=$('[data-social-kicker]'), socialSoon=$('[data-social-soon]');
    if(socialTitle)socialTitle.textContent=language==='ar'?'خدمات السوشيال ميديا':'Social Media Services';
    if(socialKicker)socialKicker.textContent=language==='ar'?'القسم قيد التجهيز':'COMING SOON';
    if(socialSoon)socialSoon.textContent=language==='ar'?'قريبًا':'Coming Soon';
    const subLabels={'[data-sub-kicker]':language==='ar'?'اشتراكات رقمية':'DIGITAL SUBSCRIPTIONS','[data-sub-title]':language==='ar'?'الاشتراكات المتاحة':'Available Subscriptions','[data-sub-text]':language==='ar'?'اختر الاشتراك الرقمي المناسب لك.':'Choose the digital subscription that suits you.','[data-sub-empty]':language==='ar'?'لا توجد اشتراكات متاحة حاليًا':'No subscriptions available yet'};
    Object.entries(subLabels).forEach(([sel,value])=>{const el=$(sel);if(el)el.textContent=value;});

    const mh = $('.marketplace-section .section-heading');
    if(mh){ mh.querySelector('.section-kicker').textContent = t('catalogKicker'); mh.querySelector('h2').textContent = document.body.dataset.page==='subscriptions'?(language==='ar'?'الاشتراكات المتاحة':'Available subscriptions'):(document.body.dataset.page==='accounts'?(language==='ar'?'الحسابات المتاحة':'Available accounts'):t('catalogTitle')); mh.querySelector('p').textContent = t('catalogText'); }
    search.placeholder = t('search');
    category.options[0].textContent = t('all');
    sort.options[0].textContent = t('newest');
    sort.options[1].textContent = t('low');
    sort.options[2].textContent = t('high');
    sort.options[3].textContent = t('followersSort');
    if(subscriptionSearch){
        subscriptionSearch.placeholder=language==='ar'?'ابحث باسم الاشتراك أو المنصة...':'Search subscriptions by name or platform...';
        subscriptionSearch.setAttribute('aria-label',language==='ar'?'ابحث في الاشتراكات':'Search subscriptions');
        subscriptionCategory.setAttribute('aria-label',language==='ar'?'تصفية الاشتراكات حسب المنصة':'Filter subscriptions by platform');
        subscriptionSort.setAttribute('aria-label',language==='ar'?'ترتيب الاشتراكات':'Sort subscriptions');
        subscriptionCategory.options[0].textContent=language==='ar'?'كل المنصات':'All platforms';
        subscriptionSort.options[0].textContent=t('newest');
        subscriptionSort.options[1].textContent=t('low');
        subscriptionSort.options[2].textContent=t('high');
        subscriptionSort.options[3].textContent=language==='ar'?'الاسم: أ–ي':'Name: A–Z';
        $('#subscriptionReset').textContent=language==='ar'?'إعادة ضبط':'Reset filters';
        $('#subscriptionEmptyReset').textContent=language==='ar'?'مسح عوامل التصفية':'Clear filters';
    }
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
    window.dispatchEvent(new CustomEvent('7sabatk:language-changed', { detail: { language } }));
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
        if (link) {
            try {
                const parsedLink = new URL(link, window.location.href);
                if (parsedLink.protocol === "http:" || parsedLink.protocol === "https:") {
                    announcementBar.href = parsedLink.href;
                    announcementBar.target = "_blank";
                    announcementBar.rel = "noopener noreferrer";
                    announcementBar.setAttribute("aria-label", announcement);
                } else {
                    announcementBar.removeAttribute("href");
                    announcementBar.removeAttribute("target");
                    announcementBar.removeAttribute("rel");
                }
            } catch {
                announcementBar.removeAttribute("href");
                announcementBar.removeAttribute("target");
                announcementBar.removeAttribute("rel");
            }
        } else {
            announcementBar.removeAttribute("href");
            announcementBar.removeAttribute("target");
            announcementBar.removeAttribute("rel");
        }
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
function fillSubscriptionCategories(){
    if(!subscriptionCategory)return;
    const selected=subscriptionCategory.value||'all';
    subscriptionCategory.innerHTML='';
    const all=document.createElement('option');all.value='all';all.textContent=language==='ar'?'كل المنصات':'All platforms';subscriptionCategory.append(all);
    [...new Set(subscriptions.map(item=>item.category).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),language)).forEach(value=>{
        const option=document.createElement('option');option.value=value;option.textContent=value;subscriptionCategory.append(option);
    });
    subscriptionCategory.value=[...subscriptionCategory.options].some(option=>option.value===selected)?selected:'all';
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
function renderSubscriptionList(){
    const container=$('#subscriptionGrid'); if(!container)return;
    const query=subscriptionSearch?.value.trim().toLocaleLowerCase(language)||'';
    const platform=subscriptionCategory?.value||'all';
    const order=subscriptionSort?.value||'newest';
    let visible=subscriptions.filter(item=>{
        const fields=[item.title,item.name,item.username,item.category,item.platform,item.provider,item.description_ar,item.description_en,item.description].filter(Boolean).join(' ').toLocaleLowerCase(language);
        return fields.includes(query)&&(platform==='all'||item.category===platform);
    });
    if(order==='priceAsc')visible.sort((a,b)=>Number(a.price_kwd??a.price??Infinity)-Number(b.price_kwd??b.price??Infinity));
    if(order==='priceDesc')visible.sort((a,b)=>Number(b.price_kwd??b.price??0)-Number(a.price_kwd??a.price??0));
    if(order==='nameAsc')visible.sort((a,b)=>String(a.title||a.name||'').localeCompare(String(b.title||b.name||''),language,{sensitivity:'base'}));
    if(order==='newest')visible.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    renderSubscriptions(visible,container,item=>showAccountDetails(item,$('#accountDialog'),{...preferences,numberLocale},rates,publicSettings,fieldDefinitions,language,fieldPlatformStates),{...preferences,numberLocale},rates,language,fieldDefinitions,fieldPlatformStates);
    const countEl=$('#subscriptionsCount');
    if(countEl)countEl.textContent=language==='ar'?`عرض ${new Intl.NumberFormat(numberLocale).format(visible.length)} من ${new Intl.NumberFormat(numberLocale).format(subscriptions.length)} اشتراك`:`Showing ${new Intl.NumberFormat(numberLocale).format(visible.length)} of ${new Intl.NumberFormat(numberLocale).format(subscriptions.length)} subscriptions`;
    const emptyEl=$('#subscriptionsEmpty');if(emptyEl){emptyEl.hidden=visible.length>0;const noProducts=subscriptions.length===0;$('#subscriptionsEmpty [data-sub-empty]').textContent=noProducts?(language==='ar'?'لا توجد اشتراكات متاحة حاليًا':'No subscriptions available yet'):(language==='ar'?'لا توجد نتائج مطابقة':'No matching subscriptions');$('#subscriptionsEmptyText').textContent=noProducts?(language==='ar'?'ستظهر الاشتراكات هنا عند إضافتها إلى المتجر.':'Subscriptions will appear here once they are added to the store.'):(language==='ar'?'جرّب تغيير كلمات البحث أو عوامل التصفية.':'Try changing your search or filters.');$('#subscriptionEmptyReset').hidden=noProducts;}
}
[search, category, sort].forEach(el => el.addEventListener('input', filter));
if(subscriptionSearch){
    fillSubscriptionCategories();
    [subscriptionSearch,subscriptionCategory,subscriptionSort].forEach(el=>el.addEventListener('input',renderSubscriptionList));
    subscriptionCategory.addEventListener('change',renderSubscriptionList);
    subscriptionSort.addEventListener('change',renderSubscriptionList);
    const resetSubscriptionFilters=()=>{subscriptionSearch.value='';subscriptionCategory.value='all';subscriptionSort.value='newest';renderSubscriptionList();};
    $('#subscriptionReset').addEventListener('click',resetSubscriptionFilters);
    $('#subscriptionEmptyReset').addEventListener('click',resetSubscriptionFilters);
}
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
    renderSubscriptionList();
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
                    emailRedirectTo: 'https://7sabatk.sevenxtech.workers.dev/',
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
        redirectTo: 'https://7sabatk.sevenxtech.workers.dev/'
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
    const { data: p, error: profileError } = await supabase.from('profiles').select('role,full_name,username,email,avatar_url,is_banned').eq('id', session.user.id).maybeSingle();
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
    // Show the dashboard shortcut to every active administrator.
    $('#adminShortcut').hidden = profile.role !== 'admin' || !!profile.is_banned;
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
        redirectTo: 'https://7sabatk.sevenxtech.workers.dev/'
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
        subscriptions = await loadSubscriptions();
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
        fillSubscriptionCategories();
        filter();
        renderSubscriptionList();
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
    if (window.location.hash === '#register') {
        setAuthMode('signup');
        openDialog('authDialog');
    }
}
boot();
