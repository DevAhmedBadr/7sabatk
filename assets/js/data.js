// تحميل بيانات الحسابات من ملف JSON المنفصل.
export async function loadAccounts() {
  const response = await fetch("data/accounts.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`تعذر تحميل البيانات: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.accounts) ? data.accounts : [];
}
