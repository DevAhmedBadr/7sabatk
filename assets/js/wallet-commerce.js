import { supabase, isSupabaseConfigured } from './backend.js';
import { getSiteLanguage } from './site-language.js';

const CART_KEY='7sabatk.social.cart.v1';
const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lang=()=>document.documentElement.lang==='ar'?'ar':'en';
const tr=(ar,en)=>lang()==='ar'?ar:en;
const fmt=n=>`${new Intl.NumberFormat(lang(),{minimumFractionDigits:3,maximumFractionDigits:3}).format(Number(n)||0)} KWD`;
let balance=0, signedIn=false, drawer, orderHistory=[];
const getCart=()=>{try{const v=JSON.parse(localStorage.getItem(CART_KEY)||'[]');return Array.isArray(v)?v:[]}catch{return[]}};
const saveCart=items=>{localStorage.setItem(CART_KEY,JSON.stringify(items));updateButtons()};
const total=items=>items.reduce((n,x)=>n+Math.round(Number(x.price_per_1000_kwd)*Number(x.quantity)/1000*1000)/1000,0);
function toast(text,error=false){let el=$('#walletCommerceToast');if(!el){el=document.createElement('div');el.id='walletCommerceToast';el.className='wallet-toast';document.body.append(el)}el.textContent=text;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),5000)}
function ensureControls(){
 const nav=$('.nav-actions');if(!nav||$('#socialWalletActions'))return;
 const box=document.createElement('div');box.id='socialWalletActions';box.className='wallet-actions';
 box.innerHTML=`<button type="button" class="wallet-button" id="walletBalanceButton" aria-label="${tr('رصيد المحفظة','Wallet balance')}" title="${tr('رصيد المحفظة','Wallet balance')}"><svg class="wallet-coin-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.7-.7-1.7-1-3-1-1.8 0-3 .8-3 2s1.1 1.8 3 2.2 3 1 3 2.2-1.2 2.1-3.2 2.1c-1.3 0-2.5-.4-3.3-1.2M12.3 6v12"/></svg><span class="wallet-label">${tr('الرصيد','Balance')}</span><strong id="walletBalanceValue">…</strong></button><button type="button" class="cart-button" id="walletCartButton" aria-label="${tr('سلة الخدمات','Services cart')}" title="${tr('سلة الخدمات','Services cart')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><span class="cart-label">${tr('السلة','Cart')}</span><span class="cart-count" id="walletCartCount">0</span></button>`;
 nav.prepend(box);
 const requireSignIn=async()=>{if(await refreshSessionState())return true;toast(tr('يرجى تسجيل الدخول في الموقع لرؤية رصيدك','Please sign in to view your balance.'),true);return false};
 $('#walletBalanceButton').addEventListener('click',async()=>{if(!await requireSignIn())return;openDrawer()});
 $('#walletCartButton').addEventListener('click',async()=>{if(!await requireSignIn())return;openDrawer()});
}
function updateButtons(){const count=$('#walletCartCount');if(count)count.textContent=String(getCart().length);const val=$('#walletBalanceValue');if(val)val.textContent=signedIn?fmt(balance):tr('سجّل الدخول','Sign in');}
function ensureDrawer(){if(drawer)return drawer;drawer=document.createElement('div');drawer.className='wallet-drawer-backdrop';drawer.hidden=true;drawer.innerHTML=`<section class="wallet-drawer" role="dialog" aria-modal="true" aria-labelledby="walletDrawerTitle"><div class="wallet-drawer-head"><h2 id="walletDrawerTitle">${tr('الرصيد والسلة','Wallet & cart')}</h2><button class="wallet-close" type="button" aria-label="${tr('إغلاق','Close')}">×</button></div><div id="walletDrawerBody"></div></section>`;document.body.append(drawer);drawer.addEventListener('click',e=>{if(e.target===drawer||e.target.closest('.wallet-close'))closeDrawer()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer()});return drawer;}
function openDrawer(){ensureDrawer().hidden=false;renderDrawer();document.body.classList.add('dialog-open')}
function closeDrawer(){if(drawer){drawer.hidden=true;document.body.classList.remove('dialog-open')}}
function renderDrawer(){
 const cart=getCart(),body=$('#walletDrawerBody');
 body.innerHTML=`<div class="wallet-balance"><span>${tr('رصيدك الحالي','Current balance')}</span><strong>${fmt(balance)}</strong></div><div class="wallet-cart-lines">${cart.length?cart.map((item,i)=>`<div class="wallet-line" data-index="${i}"><div><h3>${esc(item[`name_${lang()}`]||item.name_en)}</h3><p>${esc(item.target_url)} · ${fmt(item.price_per_1000_kwd*item.quantity/1000)}</p><button class="wallet-remove" data-remove="${i}" type="button">${tr('إزالة','Remove')}</button></div><input data-quantity="${i}" type="number" min="${item.min_quantity}" max="${item.max_quantity}" step="${item.quantity_step}" value="${item.quantity}" aria-label="${tr('الكمية','Quantity')}"></div>`).join(''):`<div class="wallet-empty">${tr('سلتك فارغة حاليًا.','Your cart is empty.')}</div>`}</div><div class="wallet-total"><span>${tr('الإجمالي','Total')}</span><strong>${fmt(total(cart))}</strong></div><button class="button full-button" id="walletCheckout" type="button" ${cart.length?'':'disabled'}>${tr('إتمام الشراء من الرصيد','Checkout with balance')}</button><div class="wallet-balance"><span>${tr('شحن الرصيد','Add funds')}</span><strong>${tr('قريبًا','Coming soon')}</strong></div><p class="wallet-note">${tr('ستضاف بوابات Apple Pay وPayPal وBinance في مرحلة لاحقة. لا يتم تنفيذ أي شحن حقيقي الآن.','Apple Pay, PayPal and Binance top-ups will be added later. No real deposits are processed yet.')}</p><h3>${tr('طلباتي الأخيرة','Recent orders')}</h3><div class="wallet-order-history">${orderHistory.length?orderHistory.map(o=>`<article class="wallet-order"><div><strong>${tr('طلب','Order')} #${esc(o.id.slice(0,8))}</strong><small>${new Date(o.created_at).toLocaleString(lang())}</small></div><span>${fmt(o.total_kwd)}</span><b>${esc(tr(({pending:'قيد المراجعة',processing:'قيد التنفيذ',completed:'مكتمل',cancelled:'ملغي',refunded:'مسترد'})[o.status]||o.status,({pending:'Under review',processing:'Processing',completed:'Completed',cancelled:'Cancelled',refunded:'Refunded'})[o.status]||o.status))}</b></article>`).join(''):`<div class="wallet-empty">${tr('لا توجد طلبات بعد.','No orders yet.')}</div>`}</div><p class="wallet-status" id="walletStatus" role="status"></p>`;
 body.querySelectorAll('[data-remove]').forEach(btn=>btn.addEventListener('click',()=>{const items=getCart();items.splice(Number(btn.dataset.remove),1);saveCart(items);renderDrawer()}));
 body.querySelectorAll('[data-quantity]').forEach(input=>input.addEventListener('change',()=>{const items=getCart(),i=Number(input.dataset.quantity),item=items[i],qty=Number(input.value);if(!Number.isInteger(qty)||qty<item.min_quantity||qty>item.max_quantity||(qty-item.min_quantity)%item.quantity_step!==0){input.value=item.quantity;return;}item.quantity=qty;saveCart(items);renderDrawer()}));
 $('#walletCheckout')?.addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await checkout()}finally{button.disabled=false}});
}
async function loadBalance(){if(!isSupabaseConfigured)return;const {data:{session}}=await supabase.auth.getSession();signedIn=!!session;if(!signedIn){balance=0;orderHistory=[];updateButtons();return;}const [wallet,orders]=await Promise.all([supabase.rpc('get_my_wallet_balance'),supabase.from('social_service_orders').select('id,total_kwd,status,created_at').order('created_at',{ascending:false}).limit(10)]);if(wallet.error){console.warn('Wallet balance unavailable. Apply the social-commerce migration.',wallet.error);balance=0;}else balance=Number(wallet.data)||0;if(orders.error)orderHistory=[];else orderHistory=orders.data||[];updateButtons();if(drawer&&!drawer.hidden)renderDrawer();}
async function refreshSessionState(){if(!isSupabaseConfigured)return false;const {data:{session}}=await supabase.auth.getSession();signedIn=!!session;updateButtons();return signedIn;}
async function checkout(items=getCart(),clearCart=true){
 const status=$('#walletStatus');if(status){status.className='wallet-status';status.textContent=tr('جارٍ إتمام الطلب…','Processing your order…')}
 const {data,error}=await supabase.rpc('purchase_social_services',{p_items:items.map(i=>({service_id:i.service_id,quantity:i.quantity,target_url:i.target_url}))});
 if(error){const text=error.message||tr('تعذر إتمام الطلب.','Could not complete the order.');if(status){status.className='wallet-status error';status.textContent=text}toast(text,true);return false;}
 if(clearCart)saveCart([]);
 balance=Number(data?.balance_kwd)||0;updateButtons();
 if(status){status.className='wallet-status';status.textContent=tr(`تم الشراء بنجاح. رقم الطلب: ${data?.order_id||''}`,`Purchase complete. Order: ${data?.order_id||''}`)}
 if(drawer&&!drawer.hidden)renderDrawer();
 await loadBalance();
 toast(tr(`تم الشراء بنجاح. رقم الطلب: ${data?.order_id||''}`,`Purchase complete. Order: ${data?.order_id||''}`));
 return true;
}
window.addEventListener('7sabatk:cart-add',async e=>{
 const {item,buyNow,button}=e.detail||{};if(!item)return;
 if(!isSupabaseConfigured){alert(tr('قاعدة البيانات غير مهيأة.','Database is not configured.'));return;}
 if(!await refreshSessionState()){$('#authOpen')?.click();return;}
 if(buyNow){if(confirm(tr('تأكيد شراء هذه الخدمة وخصم قيمتها من رصيدك؟','Confirm purchase and deduct the amount from your balance?'))){if(button)button.disabled=true;try{await checkout([item],false)}finally{if(button)button.disabled=false}}return;}
 const items=getCart();items.push(item);saveCart(items);openDrawer();
});
await getSiteLanguage();
ensureControls();updateButtons();
if(isSupabaseConfigured){loadBalance();supabase.auth.onAuthStateChange(()=>setTimeout(loadBalance,0));}
