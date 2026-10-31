import { formatPrice } from "./preferences.js";
const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const escapeAttr=escapeHtml;
function formatNumber(value,locale="ar"){if(value===null||value===undefined||value==="")return "—";return new Intl.NumberFormat(locale).format(value);}
export function renderAccounts(accounts,container,onDetails,preferences,rates,fieldDefinitions=[],language="ar"){
  container.innerHTML="";
  const labels=language==="ar"?{followers:"المتابعون",views:"متوسط المشاهدات",details:"عرض التفاصيل ←",available:"متاح",unavailable:"غير متاح",username:"اسم المستخدم"}:{followers:"Followers",views:"Average views",details:"View details →",available:"Available",unavailable:"Unavailable",username:"Username"};
  for(const account of accounts){
    const card=document.createElement("article");card.className="account-card";
    const image=account.image_url||account.image||"";
    const avatar=image?`<img class="card-cover-image" src="${escapeAttr(image)}" alt="${escapeAttr(account.title||"")}" loading="lazy">`:`<div class="card-avatar">${escapeHtml((account.title||account.name||"7S").slice(0,2).toUpperCase())}</div>`;
    const title=account.title||account.name||(language==="ar"?"بدون اسم":"Untitled account");
    const custom=account.custom_fields&&typeof account.custom_fields==="object"?account.custom_fields:{};
    const dynamicStats=fieldDefinitions.filter(f=>f.is_active&&custom[f.field_key]!==undefined&&custom[f.field_key]!==null&&custom[f.field_key]!=="").slice(0,2).map(f=>({label:language==="ar"?f.label_ar:f.label_en,value:custom[f.field_key]}));
    const stats=dynamicStats.length?dynamicStats:[{label:labels.followers,value:account.followers_count??account.followers??0},{label:labels.views,value:account.views_count??account.average_views??0}];
    card.innerHTML=`<div class="card-cover">${avatar}</div><div class="card-body"><span class="category-tag">${escapeHtml(account.category||(language==="ar"?"حساب رقمي":"Digital account"))}</span><h3>${escapeHtml(title)}</h3><div class="card-username">${escapeHtml(account.username?`@${account.username}`:"")}</div><div class="card-stats">${stats.map(s=>`<div><b>${escapeHtml(formatNumber(s.value,preferences.numberLocale))}</b>${escapeHtml(s.label||"")}</div>`).join("")}</div><div class="price-row"><strong>${formatPrice(account.price_kwd??account.price,preferences.currency,rates,preferences.numberLocale)}</strong><span>${account.is_available===false?labels.unavailable:labels.available}</span></div><div class="card-footer"><span class="ref-id">${escapeHtml(account.reference||account.id||"")}</span><button class="details-button" type="button">${labels.details}</button></div></div>`;
    card.querySelector("button").addEventListener("click",()=>onDetails(account));container.appendChild(card);
  }
}
export function showAccountDetails(account,dialog,preferences,rates,settings,fieldDefinitions=[],language="ar"){
  const ar=language==="ar",title=account.title||account.name||(ar?"حساب بدون اسم":"Untitled account");
  dialog.querySelector("#detailCategory").textContent=account.category||(ar?"حساب رقمي":"Digital account");dialog.querySelector("#detailTitle").textContent=title;dialog.querySelector("#detailUsername").textContent=account.username?`@${account.username}`:"";dialog.querySelector("#detailPrice").textContent=formatPrice(account.price_kwd??account.price,preferences.currency,rates,preferences.numberLocale);
  const image=dialog.querySelector("#detailImage");image.innerHTML=account.image_url||account.image?`<img src="${escapeAttr(account.image_url||account.image)}" alt="${escapeAttr(title)}">`:`<span>7S</span>`;
  const labels=ar?{followers:"المتابعون",views:"متوسط المشاهدات",engagement:"معدل التفاعل"}:{followers:"Followers",views:"Average views",engagement:"Engagement"};
  const stats=[{label:labels.followers,value:account.followers_count??account.followers},{label:labels.views,value:account.views_count??account.average_views},{label:labels.engagement,value:account.engagement}].filter(x=>x.value!==null&&x.value!==undefined&&x.value!=="");
  for(const f of fieldDefinitions.filter(f=>f.is_active)){const v=account.custom_fields?.[f.field_key];if(v!==null&&v!==undefined&&v!=="")stats.push({label:ar?f.label_ar:f.label_en,value:v});}
  dialog.querySelector("#detailStats").innerHTML=stats.map(s=>`<div class="modal-stat"><b>${escapeHtml(s.value)}</b><span>${escapeHtml(s.label)}</span></div>`).join("");dialog.querySelector("#detailDescription").textContent=account.description||(ar?"لا توجد تفاصيل إضافية.":"No additional details.");
  const contact=dialog.querySelector("#detailContact");if(settings.whatsapp_number){const msg=encodeURIComponent(`${ar?"مرحبًا، أريد الاستفسار عن":"Hello, I’m interested in"} ${title} (${account.reference||account.id||""}).`);contact.href=`https://wa.me/${settings.whatsapp_number}?text=${msg}`;contact.target="_blank";contact.rel="noopener";}else if(settings.contact_email)contact.href=`mailto:${settings.contact_email}?subject=${encodeURIComponent("Inquiry: "+title)}`;else contact.href="#contact";
  openDialog("accountDialog");
}
export function openDialog(id){const el=document.getElementById(id);el.classList.add("open");el.setAttribute("aria-hidden","false");document.body.classList.add("dialog-open");}
export function closeDialog(id){const el=document.getElementById(id);if(!el)return;el.classList.remove("open");el.setAttribute("aria-hidden","true");if(!document.querySelector(".overlay.open"))document.body.classList.remove("dialog-open");}
