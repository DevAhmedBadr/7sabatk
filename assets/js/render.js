export function renderAccounts(accounts, container, onDetails) {
  container.innerHTML = "";
  for (const account of accounts) {
    const card = document.createElement("article");
    card.className = "account-card";
    const avatar = account.image
      ? `<img src="${escapeAttr(account.image)}" alt="">`
      : escapeHtml((account.title || "DH").slice(0, 2).toUpperCase());
    card.innerHTML = `
      <div class="card-cover"><div class="card-avatar">${avatar}</div></div>
      <div class="card-body">
        <span class="category-tag">${escapeHtml(account.category || "عام")}</span>
        <h3>${escapeHtml(account.title || "بدون اسم")}</h3>
        <div class="card-username">${escapeHtml(account.username || "")}</div>
        <div class="card-stats">
          <div><b>${formatNumber(account.followers)}</b>المتابعون</div>
          <div><b>${formatNumber(account.averageViews)}</b>متوسط المشاهدات</div>
        </div>
        <div class="card-footer">
          <span class="ref-id">${escapeHtml(account.id || "")}</span>
          <button class="details-button" type="button">عرض التفاصيل ←</button>
        </div>
      </div>`;
    card.querySelector("button").addEventListener("click", () => onDetails(account));
    container.appendChild(card);
  }
}
export function showAccountDetails(account, modal, settings) {
  modal.querySelector("#modalCategory").textContent = account.category || "تفاصيل الحساب";
  modal.querySelector("#modalTitle").textContent = account.title || "بدون اسم";
  modal.querySelector("#modalUsername").textContent = account.username || "";
  const avatar = modal.querySelector("#modalAvatar");
  if (account.image) avatar.innerHTML = `<img src="${escapeAttr(account.image)}" alt="">`;
  else avatar.textContent = (account.title || "DH").slice(0, 2).toUpperCase();
  const stats = [
    ["المتابعون", formatNumber(account.followers)],
    ["متوسط المشاهدات", formatNumber(account.averageViews)],
    ["التفاعل", account.engagement || "—"]
  ];
  modal.querySelector("#modalStats").innerHTML = stats.map(([label, value]) =>
    `<div class="modal-stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`
  ).join("");
  modal.querySelector("#modalDescription").textContent = account.description || "لا توجد تفاصيل إضافية.";
  const contact = modal.querySelector("#modalContact");
  if (settings.whatsappNumber) {
    const message = encodeURIComponent(`مرحبًا، أريد الاستفسار عن ${account.title} (${account.id}).`);
    contact.href = `https://wa.me/${settings.whatsappNumber}?text=${message}`;
    contact.target = "_blank";
    contact.rel = "noopener";
  } else if (settings.contactEmail) {
    contact.href = `mailto:${settings.contactEmail}?subject=${encodeURIComponent("استفسار عن " + account.title)}`;
  } else {
    contact.href = "#contact";
  }
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}
function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("ar").format(value);
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function escapeAttr(value) { return escapeHtml(value); }
