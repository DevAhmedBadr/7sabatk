import { supabase } from './backend.js';

const OWNER_ID = 'be398df3-3918-46e1-abc4-59975ffe716b';
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let categories = [];
let subcategories = [];
let loaded = false;

function message(text, error = false) {
  const el = $('#supportCategoriesMessage');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('error', error);
  el.hidden = false;
}
function slug(prefix) { return `${prefix}_${Date.now().toString(36)}`.slice(0, 60); }
function active(value) { return value ? 'checked' : ''; }

function render() {
  const categoryRows = $('#supportCategoriesRows');
  const subRows = $('#supportSubcategoriesRows');
  const parent = $('#supportSubcategoryParent');
  if (!categoryRows || !subRows || !parent) return;
  categoryRows.innerHTML = categories.length ? categories.map((c) => `<tr data-category-row="${c.id}"><td>${esc(c.slug)}</td><td><input aria-label="اسم الفئة بالعربية" data-field="name_ar" value="${esc(c.name_ar)}" maxlength="120"></td><td><input aria-label="Category name in English" data-field="name_en" value="${esc(c.name_en)}" maxlength="120"></td><td><input aria-label="ترتيب العرض" data-field="sort_order" type="number" value="${Number(c.sort_order)}"></td><td><input aria-label="مفعّلة" data-field="is_active" type="checkbox" ${active(c.is_active)}></td><td><button class="button button-small" data-save-category="${c.id}">حفظ</button></td></tr>`).join('') : '<tr><td colspan="6">لا توجد فئات.</td></tr>';
  subRows.innerHTML = subcategories.length ? subcategories.map((s) => `<tr data-subcategory-row="${s.id}"><td>${esc(categories.find((c) => c.id === s.category_id)?.name_ar || '—')}</td><td>${esc(s.slug)}</td><td><input aria-label="اسم الفئة الفرعية بالعربية" data-field="name_ar" value="${esc(s.name_ar)}" maxlength="120"></td><td><input aria-label="Subcategory name in English" data-field="name_en" value="${esc(s.name_en)}" maxlength="120"></td><td><input aria-label="ترتيب العرض" data-field="sort_order" type="number" value="${Number(s.sort_order)}"></td><td><input aria-label="مفعّلة" data-field="is_active" type="checkbox" ${active(s.is_active)}></td><td><button class="button button-small" data-save-subcategory="${s.id}">حفظ</button></td></tr>`).join('') : '<tr><td colspan="7">لا توجد فئات فرعية.</td></tr>';
  parent.innerHTML = `<option value="">اختر الفئة الرئيسية</option>${categories.filter((c) => c.is_active).map((c) => `<option value="${c.id}">${esc(c.name_ar)} / ${esc(c.name_en)}</option>`).join('')}`;
  categoryRows.querySelectorAll('[data-save-category]').forEach((b) => b.addEventListener('click', () => saveCategory(b.dataset.saveCategory)));
  subRows.querySelectorAll('[data-save-subcategory]').forEach((b) => b.addEventListener('click', () => saveSubcategory(b.dataset.saveSubcategory)));
}
async function load() {
  const [cat, sub] = await Promise.all([
    supabase.from('support_categories').select('*').order('sort_order').order('id'),
    supabase.from('support_subcategories').select('*').order('sort_order').order('id')
  ]);
  if (cat.error || sub.error) throw cat.error || sub.error;
  categories = cat.data || [];
  subcategories = sub.data || [];
  render();
}
function values(row) {
  return { name_ar: row.querySelector('[data-field="name_ar"]').value.trim(), name_en: row.querySelector('[data-field="name_en"]').value.trim(), sort_order: Number(row.querySelector('[data-field="sort_order"]').value || 100), is_active: row.querySelector('[data-field="is_active"]').checked, updated_at: new Date().toISOString() };
}
async function saveCategory(id) {
  const row = document.querySelector(`[data-category-row="${CSS.escape(id)}"]`);
  const { error } = await supabase.from('support_categories').update(values(row)).eq('id', Number(id));
  if (error) return message(`تعذر حفظ الفئة: ${error.message}`, true);
  message('تم حفظ الفئة.'); await load();
}
async function saveSubcategory(id) {
  const row = document.querySelector(`[data-subcategory-row="${CSS.escape(id)}"]`);
  const { error } = await supabase.from('support_subcategories').update(values(row)).eq('id', Number(id));
  if (error) return message(`تعذر حفظ الفئة الفرعية: ${error.message}`, true);
  message('تم حفظ الفئة الفرعية.'); await load();
}
$('#supportCategoryForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const { error } = await supabase.from('support_categories').insert({ slug: slug('category'), name_ar: String(data.get('name_ar')).trim(), name_en: String(data.get('name_en')).trim(), sort_order: Number(data.get('sort_order') || 100), is_active: true });
  if (error) return message(`تعذر إضافة الفئة: ${error.message}`, true);
  event.currentTarget.reset(); message('تمت إضافة الفئة.'); await load();
});
$('#supportSubcategoryForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const categoryId = Number(data.get('category_id'));
  if (!categoryId) return message('اختر الفئة الرئيسية أولًا.', true);
  const { error } = await supabase.from('support_subcategories').insert({ category_id: categoryId, slug: slug('sub'), name_ar: String(data.get('name_ar')).trim(), name_en: String(data.get('name_en')).trim(), sort_order: Number(data.get('sort_order') || 100), is_active: true });
  if (error) return message(`تعذر إضافة الفئة الفرعية: ${error.message}`, true);
  event.currentTarget.reset(); message('تمت إضافة الفئة الفرعية.'); await load();
});
window.addEventListener('7sabatk:admin-section', async (event) => {
  if (event.detail?.name !== 'support-categories' || loaded) return;
  $('#section-support-categories')?.removeAttribute('hidden');
  loaded = true;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== OWNER_ID) throw new Error('إدارة الفئات متاحة لمالك الموقع فقط.');
    await load();
  } catch (error) { message(error.message, true); loaded = false; }
});
