import { formatPrice } from "./preferences.js";
export function renderAccounts(accounts,container,onDetails,preferences,rates){
  container.innerHTML="";
  for(const account of accounts){
    const card=document.createElement("article"); card.className="account-card";
    const image=account.image_url||account.image||"";
    const avatar=image?`<img src="${escapeAttr(image)}" alt="" loading="lazy">`:escapeHtml((account.title||account.name||"7S").slice(0,2).toUpperCase());
    const title=account.title||account.name||"بدون اسم";
    card.innerHTML=`<div class="card-cover"><div class="card-avatar">${avatar}</div></div><div class="card-body"><span class="category-tag">${escapeHtml(account.category||"عام")}</span><h3>${escapeHtml(title)}</h3><div class="card-username">${escapeHtml(account.username||"")}</div><div class="card-stats"><div><b>${formatNumber(account.followers,preferences.numberLocale)}</b>المتابعون</div><div><b>${formatNumber(account.average_views??account.averageViews,preferences.numberLocale)}</b>متوسط المشاهدات</div></div><div class="price-row"><strong>${formatPrice(account.price_kwd??account.price,preferences.currency,rates,preferences.numberLocale)}</strong><span>${account.is_available===false?"غير متاح":"متاح"}</span></div><div class="card-footer"><span class="ref-id">${escapeHtml(account.reference||account.id||"")}</span><button class="details-button" type="button">عرض التفاصيل ←</button></div></div>`;
    card.querySelector("button").addEventListener("click",()=>onDetails(account)); container.appendChild(card);
  }
}
export function showAccountDetails(account,dialog,preferences,rates,settings){
  const title=account.title||account.name||"بدون اسم";
  dialog.querySelector("#detailCategory").textContent=account.category||"تفاصيل العرض";
  dialog.querySelector("#detailTitle").textContent=title;
  dialog.querySelector("#detailUsername").textContent=account.username||"";
  dialog.querySelector("#detailPrice").textContent=formatPrice(account.price_kwd??account.price,preferences.currency,rates,preferences.numberLocale);
  const image=dialog.querySelector("#detailImage"); image.innerHTML=account.image_url||account.image?`<img src="${escapeAttr(account.image_url||account.image)}" alt="">`:`<span>7S</span>`;
  const stats=[["المتابعون",formatNumber(account.followers,preferences.numberLocale)],["متوسط المشاهدات",formatNumber(account.average_views??account.averageViews,preferences.numberLocale)],["التفاعل",account.engagement||"—"]];
  dialog.querySelector("#detailStats").innerHTML=stats.map(([label,value])=>`<div class="modal-stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join("");
  dialog.querySelector("#detailDescription").textContent=account.description||"لا توجد تفاصيل إضافية.";
  const contact=dialog.querySelector("#detailContact");
  if(settings.whatsapp_number){const msg=encodeURIComponent(`مرحبًا، أريد الاستفسار عن ${title} (${account.reference||account.id||""}).`);contact.href=`https://wa.me/${settings.whatsapp_number}?text=${msg}`;contact.target="_blank";contact.rel="noopener";}
  else if(settings.contact_email) contact.href=`mailto:${settings.contact_email}?subject=${encodeURIComponent("استفسار عن "+title)}`;
  else contact.href="#contact";
  openDialog("accountDialog");
}
export function openDialog(id){const el=document.getElementById(id);el.classList.add("open");el.setAttribute("aria-hidden","false");document.body.classList.add("dialog-open");}
export function closeDialog(id){const el=document.getElementById(id);if(!el)return;el.classList.remove("open");el.setAttribute("aria-hidden","true");if(!document.querySelector(".overlay.open"))document.body.classList.remove("dialog-open");}
function formatNumber(value,locale="ar"){if(value===null||value===undefined||value==="")return "—";return new Intl.NumberFormat(locale).format(value);}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
function escapeAttr(value){return escapeHtml(value);}
