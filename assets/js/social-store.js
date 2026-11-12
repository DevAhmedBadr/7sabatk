import { supabase, isSupabaseConfigured } from './backend.js';
import { getSiteLanguage } from './site-language.js';

const $ = (s, root=document) => root.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => `${new Intl.NumberFormat(document.documentElement.lang === 'ar' ? 'ar' : 'en', {minimumFractionDigits:3,maximumFractionDigits:3}).format(Number(value)||0)} KWD`;
let language = 'ar';
const localized = (row, field) => row?.[`${field}_${language}`] || row?.[`${field}_en`] || '';
function message(text, error=false){const box=$('#socialStoreMessage');if(!box)return;box.textContent=text;box.classList.toggle('error',error);box.hidden=!text;}
function brandArt(brand){
  if(brand==='tiktok') return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M38 7v31a13 13 0 1 1-11-12.8" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M39 8c2.5 8 7.5 12.5 16 14" stroke="#ff5aa5" stroke-width="7" stroke-linecap="round"/><path d="M35 12v31a13 13 0 1 1-11-12.8" stroke="#38e7df" stroke-width="4" stroke-linecap="round"/></svg>';
  if(brand==='instagram') return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect x="8" y="8" width="48" height="48" rx="15" stroke="currentColor" stroke-width="5"/><circle cx="32" cy="32" r="11" stroke="currentColor" stroke-width="5"/><circle cx="47" cy="17" r="3" fill="currentColor"/></svg>';
  return '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M13 18h38v29H13zM20 11h24M20 53h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M23 33h18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
}
function renderCategory(category){
  const title=localized(category,'name'), description=localized(category,'description');
  return `<a class="social-category-card" data-brand="${esc(category.brand)}" href="social-services.html?category=${encodeURIComponent(category.slug)}"><span class="social-category-art">${brandArt(category.brand)}</span><span class="social-category-copy"><h2>${esc(title)}</h2><p>${esc(description || (language==='ar'?'تصفح الخدمات المتاحة لهذه المنصة.':'Browse available services for this platform.'))}</p></span><span class="social-category-arrow" aria-hidden="true">${language==='ar'?'←':'→'}</span></a>`;
}
function renderService(service){
  const name=localized(service,'name'), description=localized(service,'description'), price=Number(service.price_per_1000_kwd)||0;
  const priceHtml=price>0?`${money(price)} <small>/ 1,000</small>`:`<span class="social-price-note">${language==='ar'?'السعر قيد الإعداد':'Price to be set'}</span>`;
  const hint=language==='ar'?'خدمة رقمية يتم طلبها من حسابك.':'A digital service ordered from your account.';
  return `<article class="social-service-card" data-service-id="${esc(service.id)}"><button class="service-accordion-toggle" data-service-toggle type="button" aria-expanded="false"><span class="service-accordion-title"><strong>${esc(name)}</strong><small>${esc(price>0?`${money(price)} / 1,000`:language==='ar'?'السعر قيد الإعداد':'Price to be set')}</small></span><span class="service-accordion-icon" aria-hidden="true">+</span></button><div class="service-accordion-panel"><div class="service-accordion-inner"><div class="service-accordion-content"><p>${esc(description||hint)}</p><div class="social-service-price">${priceHtml}</div><form class="social-service-form" data-service-form><label>${language==='ar'?'رابط الحساب أو المحتوى':'Profile or content URL'}<input name="target_url" type="url" required maxlength="2048" placeholder="https://" autocomplete="url"></label><label>${language==='ar'?'الكمية':'Quantity'}<input name="quantity" type="number" required min="${service.min_quantity}" max="${service.max_quantity}" step="${service.quantity_step}" value="${service.min_quantity}"></label><div class="social-service-actions"><button class="button button-ghost" type="button" data-cart ${price<=0?'disabled':''}>${language==='ar'?'أضف للسلة':'Add to cart'}</button><button class="button" type="button" data-buy ${price<=0?'disabled':''}>${language==='ar'?'اشتر الآن':'Buy now'}</button></div></form></div></div></div></article>`;
}
async function load(){
  language=await getSiteLanguage();
  const isAr=language==='ar';
  $('#socialKicker').textContent=isAr?'خدمات السوشيال ميديا':'SOCIAL MEDIA SERVICES';
  $('#socialTitle').textContent=isAr?'اختر منصتك':'Choose your platform';
  $('#socialIntro').textContent=isAr?'خدمات رقمية واضحة، أسعار محددة، وطلب تتابعه من حسابك.':'Clear services, transparent pricing, and orders you can track from your account.';
  $('#socialBack').textContent=isAr?'← العودة إلى المنصات':'← Back to platforms';
  document.title=isAr?'خدمات السوشيال ميديا | 7sabatk':'Social Media Services | 7sabatk';
  const slug=new URLSearchParams(location.search).get('category');
  if(!isSupabaseConfigured){message(isAr?'خدمة قاعدة البيانات غير مهيأة.':'The database connection is not configured.',true);return;}
  const {data:categories,error}=await supabase.from('social_service_categories').select('*').eq('is_active',true).order('sort_order');
  if(error){message(isAr?'تعذر تحميل الخدمات. شغّل ترحيل social-commerce في Supabase ثم أعد المحاولة.':'Could not load services. Apply the social-commerce Supabase migration, then retry.',true);return;}
  const category=categories.find(c=>c.slug===slug);
  if(!slug){$('#socialHub').innerHTML=categories.length?categories.map(renderCategory).join(''):`<div class="social-store-message">${isAr?'لا توجد منصات متاحة حاليًا.':'No platforms are available yet.'}</div>`;return;}
  if(!category){$('#socialHub').hidden=false;$('#socialHub').innerHTML=categories.map(renderCategory).join('');message(isAr?'هذا القسم غير متاح.':'This section is unavailable.',true);return;}
  $('#socialHub').hidden=true;$('#socialDetail').hidden=false;
  const brandTitles={tiktok:isAr?'خدمات تيك توك':'TikTok services',instagram:isAr?'خدمات إنستجرام':'Instagram services'};
  $('#socialPlatformTitle').textContent=localized(category,'name')||brandTitles[category.brand]||brandTitles.tiktok;
  $('#socialPlatformDescription').textContent=localized(category,'description');
  $('#socialPlatformKicker').textContent=(category.brand||'social').toUpperCase()+' SERVICES';
  $('#socialPlatformMark').innerHTML=brandArt(category.brand);
  $('#socialPlatformBanner').dataset.brand=category.brand;
  const {data:services,error:serviceError}=await supabase.from('social_services').select('*').eq('category_id',category.id).eq('is_active',true).order('sort_order');
  if(serviceError){message(isAr?'تعذر تحميل خدمات هذه المنصة.':'Could not load this platform’s services.',true);return;}
  $('#socialServiceGrid').innerHTML=services.length?services.map(renderService).join(''):`<div class="social-store-message">${isAr?'لا توجد خدمات متاحة في هذا القسم بعد.':'There are no active services in this category yet.'}</div>`;
  $('#socialServiceGrid').addEventListener('click', async event=>{
    const toggle=event.target.closest('[data-service-toggle]');
    if(toggle){const card=toggle.closest('[data-service-id]');const expanded=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!expanded));card.classList.toggle('expanded',!expanded);return;}
    const button=event.target.closest('[data-cart],[data-buy]');if(!button)return;
    const form=button.closest('[data-service-form]');if(!form.reportValidity())return;
    const card=button.closest('[data-service-id]');const service=services.find(item=>item.id===card.dataset.serviceId);
    const item={service_id:service.id,name_ar:service.name_ar,name_en:service.name_en,price_per_1000_kwd:Number(service.price_per_1000_kwd),min_quantity:service.min_quantity,max_quantity:service.max_quantity,quantity_step:service.quantity_step,quantity:Number(form.elements.quantity.value),target_url:form.elements.target_url.value.trim()};
    if(!item.price_per_1000_kwd){message(isAr?'لم يحدد المالك سعر هذه الخدمة بعد.':'The owner has not set a price for this service yet.',true);return;}
    window.dispatchEvent(new CustomEvent('7sabatk:cart-add',{detail:{item,buyNow:button.hasAttribute('data-buy'),button}}));
  });
}
$('#socialBack')?.addEventListener('click',()=>location.href='social-services.html');
load().catch(error=>{console.error(error);message(document.documentElement.lang==='ar'?'حدث خطأ أثناء تحميل الخدمات.':'An error occurred while loading services.',true);});
