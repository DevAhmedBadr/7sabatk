import { loadAccounts } from "./data.js";
import { renderAccounts, showAccountDetails } from "./render.js";
import { settings } from "./settings.js";

const grid = document.querySelector("#accountGrid");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const sortFilter = document.querySelector("#sortFilter");
const resultsCount = document.querySelector("#resultsCount");
const emptyState = document.querySelector("#emptyState");
const modal = document.querySelector("#accountModal");
let allAccounts = [];

function populateCategories(accounts) {
  const categories = [...new Set(accounts.map(item => item.category).filter(Boolean))].sort();
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  }
}
function applyFilters() {
  const query = searchInput.value.trim().toLocaleLowerCase("ar");
  const category = categoryFilter.value;
  let visible = allAccounts.filter(account => {
    const searchable = [account.title, account.username, account.category, account.id].join(" ").toLocaleLowerCase("ar");
    return searchable.includes(query) && (category === "all" || account.category === category);
  });
  if (sortFilter.value === "followers") visible.sort((a,b) => (b.followers || 0) - (a.followers || 0));
  if (sortFilter.value === "views") visible.sort((a,b) => (b.averageViews || 0) - (a.averageViews || 0));
  if (sortFilter.value === "newest") visible.sort((a,b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  renderAccounts(visible, grid, account => showAccountDetails(account, modal, settings));
  resultsCount.textContent = `عدد النتائج: ${new Intl.NumberFormat("ar").format(visible.length)}`;
  emptyState.hidden = visible.length > 0;
}
function closeModal() { modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true"); }
document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeModal));
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
[searchInput, categoryFilter, sortFilter].forEach(control => control.addEventListener("input", applyFilters));
document.querySelector("#year").textContent = new Date().getFullYear();

const contactLink = document.querySelector("#contactLink");
if (settings.whatsappNumber) {
  contactLink.href = `https://wa.me/${settings.whatsappNumber}`;
  contactLink.target = "_blank";
  contactLink.rel = "noopener";
} else if (settings.contactEmail) {
  contactLink.href = `mailto:${settings.contactEmail}`;
}

try {
  allAccounts = await loadAccounts();
  populateCategories(allAccounts);
  applyFilters();
} catch (error) {
  console.error(error);
  resultsCount.textContent = "تعذر تحميل البيانات";
  emptyState.hidden = false;
  emptyState.querySelector("h3").textContent = "حدث خطأ أثناء تحميل الكتالوج";
  emptyState.querySelector("p").textContent = "تأكد من وجود ملف data/accounts.json وصحة تنسيقه.";
}
