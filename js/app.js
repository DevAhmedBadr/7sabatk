import { supabase,isSupabaseConfigured } from "./backend.js";
import { loadAccounts,loadPublicSettings } from "./data.js";
import { renderAccounts,showAccountDetails,openDialog,closeDialog } from "./render.js";
import { getPreferences,savePreferences,applyTheme,getCurrencyRates } from "./preferences.js";
const $=s=>document.querySelector(s);
const grid=$("#accountGrid"),search=$("#searchInput"),category=$("#categoryFilter"),sort=$("#sortFilter"),count=$("#resultsCount"),empty=$("#emptyState");
let accounts=[],preferences=getPreferences(),rates={KWD:1},publicSettings={};
applyTheme(preferences.theme); $("#year").textContent=new Date().getFullYear();
function applySiteSettings(){
  const name=publicSettings.site_name||"7sabatk";document.title=`${name} | وجهتك الرقمية`;
  const announcement=publicSettings.announcement_text; if(announcement&&publicSettings.announcement_enabled){$("#announcement").textContent=announcement;$("#announcement").hidden=false;}
  if(publicSettings.maintenance_mode===true){$("#marketplace .container").innerHTML="<div class=\"section-heading\"><span class=\"section-kicker\">تحديثات الموقع</span><h2>نعود إليك قريبًا</h2><p>الكتالوج تحت الصيانة حاليًا. يمكنك تصفح الموقع مجددًا بعد قليل.</p></div>";}
  const contact=$("#contactLink"); if(publicSettings.whatsapp_number){contact.href=`https://wa.me/${publicSettings.whatsapp_number}`;contact.target="_blank";contact.rel="noopener";} else if(publicSettings.contact_email){contact.href=`mailto:${publicSettings.contact_email}`;}
}
function fillCategories(){const values=[...new Set(accounts.map(a=>a.category).filter(Boolean))].sort();for(const value of values){const o=document.createElement("option");o.value=value;o.textContent=value;category.append(o);}}
function filter(){const q=search.value.trim().toLocaleLowerCase("ar"),c=category.value;let list=accounts.filter(a=>(publicSettings.show_unavailable!==false||a.is_available!==false)&&[a.title,a.name,a.username,a.category,a.reference,a.id].join(" ").toLocaleLowerCase("ar").includes(q)&&(c==="all"||a.category===c));
 if(sort.value==="followers")list.sort((a,b)=>(b.followers||0)-(a.followers||0));
 if(sort.value==="priceAsc")list.sort((a,b)=>(a.price_kwd??a.price??Infinity)-(b.price_kwd??b.price??Infinity));
 if(sort.value==="priceDesc")list.sort((a,b)=>(b.price_kwd??b.price??0)-(a.price_kwd??a.price??0));
 if(sort.value==="newest")list.sort((a,b)=>String(b.created_at||b.createdAt||"").localeCompare(String(a.created_at||a.createdAt||"")));
 renderAccounts(list,grid,a=>showAccountDetails(a,$("#accountDialog"),preferences,rates,publicSettings),preferences,rates);count.textContent=`عدد النتائج: ${new Intl.NumberFormat(preferences.numberLocale).format(list.length)}`;empty.hidden=list.length>0;
}
[search,category,sort].forEach(el=>el.addEventListener("input",filter));
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeDialog(b.dataset.close)));
document.querySelectorAll(".overlay").forEach(overlay=>overlay.addEventListener("click",e=>{if(e.target===overlay)closeDialog(overlay.id);}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"){document.querySelectorAll(".overlay.open").forEach(el=>closeDialog(el.id));}});
$("#settingsOpen").addEventListener("click",()=>{ $("#currencySelect").value=preferences.currency;$("#themeSelect").value=preferences.theme;$("#numberLocale").value=preferences.numberLocale;$("#reduceMotion").checked=preferences.reduceMotion;$("#browserNotifications").checked=preferences.browserNotifications;openDialog("settingsDialog");});
$("#savePreferences").addEventListener("click",async()=>{preferences={currency:$("#currencySelect").value,theme:$("#themeSelect").value,numberLocale:$("#numberLocale").value,reduceMotion:$("#reduceMotion").checked,browserNotifications:$("#browserNotifications").checked};savePreferences(preferences);applyTheme(preferences.theme);document.documentElement.classList.toggle("reduce-motion",preferences.reduceMotion);if(preferences.browserNotifications&&"Notification" in window&&Notification.permission==="default")await Notification.requestPermission();rates=await getCurrencyRates();filter();$("#settingsMessage").textContent="تم حفظ تفضيلاتك.";});
let authMode="login";function setAuthMode(mode){authMode=mode;document.querySelectorAll("[data-auth-tab]").forEach(b=>b.classList.toggle("active",b.dataset.authTab===mode));$("#authTitle").textContent=mode==="login"?"تسجيل الدخول":"إنشاء حساب جديد";$("#authSubtitle").textContent=mode==="login"?"مرحبًا بعودتك.":"أنشئ حسابك للانضمام إلى 7sabatk.";$("#nameField").hidden=mode!=="signup";$("#authSubmit").textContent=mode==="login"?"دخول":"إنشاء الحساب";$("#authMessage").textContent="";$("#authForm [name=password]").autocomplete=mode==="login"?"current-password":"new-password";}
document.querySelectorAll("[data-auth-tab]").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.authTab)));
$("#authOpen").addEventListener("click",()=>{setAuthMode("login");openDialog("authDialog");});
$("#authForm").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),email=fd.get("email"),password=fd.get("password"),fullName=fd.get("fullName");const msg=$("#authMessage");if(!isSupabaseConfigured){msg.textContent="التسجيل غير مفعل بعد. أكمل إعداد Supabase حسب ملف README.";return;}$("#authSubmit").disabled=true;msg.textContent="جارٍ تنفيذ الطلب...";
 try{if(authMode==="signup"){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName}}});if(error)throw error;msg.textContent=data.session?"تم إنشاء الحساب وتسجيل الدخول.":"تم إنشاء الحساب. افحص بريدك لتأكيده ثم سجّل الدخول.";if(data.session){closeDialog("authDialog");await refreshAuth();}}
 else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;closeDialog("authDialog");await refreshAuth();}}
 catch(error){msg.textContent=error.message||"تعذر إكمال العملية.";}finally{$("#authSubmit").disabled=false;}
});
async function refreshAuth(){if(!isSupabaseConfigured)return;const {data:{session}}=await supabase.auth.getSession();$("#authOpen").hidden=!!session;$("#accountOpen").hidden=!session;if(session){$("#profileEmail").textContent=session.user.email||"";const {data:profile}=await supabase.from("profiles").select("role,full_name").eq("id",session.user.id).maybeSingle();$("#adminShortcut").hidden=profile?.role!=="admin";} }
$("#accountOpen").addEventListener("click",()=>openDialog("profileDialog"));$("#adminShortcut").addEventListener("click",()=>location.href="admin.html");$("#signOut").addEventListener("click",async()=>{await supabase.auth.signOut();closeDialog("profileDialog");await refreshAuth();});
try{rates=await getCurrencyRates();publicSettings=await loadPublicSettings();if(!localStorage.getItem("dh_preferences_v1")&&["KWD","USD","EUR","SAR","EGP"].includes(publicSettings.default_currency)){preferences.currency=publicSettings.default_currency;savePreferences(preferences);}applySiteSettings();accounts=await loadAccounts();fillCategories();filter();}catch(error){console.error(error);count.textContent="تعذر تحميل البيانات";empty.hidden=false;empty.querySelector("h3").textContent="حدث خطأ أثناء تحميل الكتالوج";empty.querySelector("p").textContent="تأكد من إعداد قاعدة البيانات أو ملف البيانات.";}
if(isSupabaseConfigured){await refreshAuth();supabase.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0));}else{$("#authOpen").title="يتطلب إعداد Supabase أولًا";}
