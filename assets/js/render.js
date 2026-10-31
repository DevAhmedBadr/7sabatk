import { formatPrice } from "./preferences.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const escapeAttr = escapeHtml;
function formatNumber(value, locale = "ar") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat(locale).format(value);
}
function valueForField(account, field) {
  const custom = account.custom_fields && typeof account.custom_fields === "object" ? account.custom_fields : {};
  if (custom[field.field_key] !== undefined && custom[field.field_key] !== null && custom[field.field_key] !== "") return custom[field.field_key];
  if (account[field.field_key] !== undefined && account[field.field_key] !== null && account[field.field_key] !== "") return account[field.field_key];
  if (field.field_key === "followers_count") return account.followers ?? null;
  if (field.field_key === "views_count") return account.average_views ?? null;
  return null;
}
function activeStats(account, fieldDefinitions, language) {
  const dynamic = fieldDefinitions.filter(field => field.is_active).map(field => ({
    label: language === "ar" ? field.label_ar : field.label_en,
    value: valueForField(account, field)
  })).filter(item => item.value !== null && item.value !== undefined && item.value !== "");
  if (fieldDefinitions.length) return dynamic;
  const fallback = language === "ar"
    ? [{ label: "عدد المتابعين", value: account.followers_count ?? account.followers }, { label: "متوسط المشاهدات", value: account.views_count ?? account.average_views }]
    : [{ label: "Followers", value: account.followers_count ?? account.followers }, { label: "Average views", value: account.views_count ?? account.average_views }];
  return fallback.filter(item => item.value !== null && item.value !== undefined && item.value !== "");
}
function openImageLightbox(url, title) {
  const overlay = document.getElementById("imageLightbox");
  const image = document.getElementById("lightboxImage");
  if (!overlay || !image || !url) return;
  image.src = url;
  image.alt = title || "Account image";
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
}

export function renderAccounts(accounts, container, onDetails, preferences, rates, fieldDefinitions = [], language = "ar") {
  container.innerHTML = "";
  const labels = language === "ar"
    ? { details: "عرض التفاصيل ←", available: "متاح", unavailable: "غير متاح", username: "اسم المستخدم", account: "حساب رقمي" }
    : { details: "View details →", available: "Available", unavailable: "Unavailable", username: "Username", account: "Digital account" };

  for (const account of accounts) {
    const card = document.createElement("article");
    card.className = "account-card";
    const image = account.image_url || account.image || "";
    const title = account.title || account.name || (language === "ar" ? "حساب بدون اسم" : "Untitled account");
    const avatar = image
      ? `<button type="button" class="image-preview-button" aria-label="${language === "ar" ? "عرض الصورة بالحجم الكامل" : "View full image"}"><img class="card-cover-image" src="${escapeAttr(image)}" alt="${escapeAttr(title)}" loading="lazy"></button>`
      : `<div class="card-avatar">${escapeHtml(title.slice(0, 2).toUpperCase())}</div>`;
    const stats = activeStats(account, fieldDefinitions, language).slice(0, 3);
    const ref = preferences.showReference === false ? "" : `<span class="ref-id">${escapeHtml(account.reference || account.id || "")}</span>`;
    card.innerHTML = `
      <div class="card-cover">${avatar}</div>
      <div class="card-body">
        <span class="category-tag">${escapeHtml(account.category || labels.account)}</span>
        <h3>${escapeHtml(title)}</h3>
        <div class="card-username">${escapeHtml(account.username ? `@${account.username}` : "")}</div>
        <div class="card-stats">${stats.map(s => `<div><b>${escapeHtml(formatNumber(s.value, preferences.numberLocale))}</b><span>${escapeHtml(s.label)}</span></div>`).join("")}</div>
        <div class="price-row"><strong>${formatPrice(account.price_kwd ?? account.price, preferences.currency, rates, preferences.numberLocale)}</strong><span>${account.is_available === false ? labels.unavailable : labels.available}</span></div>
        <div class="card-footer">${ref}<button class="details-button" type="button">${labels.details}</button></div>
      </div>`;
    card.querySelector(".details-button").addEventListener("click", () => onDetails(account));
    card.querySelector(".image-preview-button")?.addEventListener("click", () => openImageLightbox(image, title));
    container.appendChild(card);
  }
}

export function showAccountDetails(account, dialog, preferences, rates, settings, fieldDefinitions = [], language = "ar") {
  const ar = language === "ar";
  const title = account.title || account.name || (ar ? "حساب بدون اسم" : "Untitled account");
  dialog.querySelector("#detailCategory").textContent = account.category || (ar ? "حساب رقمي" : "Digital account");
  dialog.querySelector("#detailTitle").textContent = title;
  dialog.querySelector("#detailUsername").textContent = account.username ? `@${account.username}` : "";
  dialog.querySelector("#detailPrice").textContent = formatPrice(account.price_kwd ?? account.price, preferences.currency, rates, preferences.numberLocale);
  const image = dialog.querySelector("#detailImage");
  const imageUrl = account.image_url || account.image || "";
  image.innerHTML = imageUrl
    ? `<button type="button" class="detail-image-preview" aria-label="${ar ? "عرض الصورة بالحجم الكامل" : "View full image"}"><img src="${escapeAttr(imageUrl)}" alt="${escapeAttr(title)}"></button>`
    : `<span>7S</span>`;
  image.querySelector("button")?.addEventListener("click", () => openImageLightbox(imageUrl, title));
  const stats = activeStats(account, fieldDefinitions, language);
  dialog.querySelector("#detailStats").innerHTML = stats.map(s =>
    `<div class="modal-stat"><b>${escapeHtml(s.value)}</b><span>${escapeHtml(s.label)}</span></div>`
  ).join("");
  dialog.querySelector("#detailDescription").textContent = account.description || (ar ? "لا توجد تفاصيل إضافية." : "No additional details.");
  const contact = dialog.querySelector("#detailContact");
  if (settings.whatsapp_number) {
    const msg = encodeURIComponent(`${ar ? "مرحبًا، أريد الاستفسار عن" : "Hello, I’m interested in"} ${title} (${account.reference || account.id || ""}).`);
    contact.href = `https://wa.me/${settings.whatsapp_number}?text=${msg}`;
    contact.target = "_blank";
    contact.rel = "noopener";
  } else if (settings.contact_email) {
    contact.href = `mailto:${settings.contact_email}?subject=${encodeURIComponent("Inquiry: " + title)}`;
  } else {
    contact.href = "#contact";
  }
  openDialog("accountDialog");
}
export function openDialog(id) {
  const el = document.getElementById(id);
  el.classList.add("open");
  el.setAttribute("aria-hidden", "false");
  document.body.classList.add("dialog-open");
}
export function closeDialog(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("open");
  el.setAttribute("aria-hidden", "true");
  if (!document.querySelector(".overlay.open")) document.body.classList.remove("dialog-open");
}
