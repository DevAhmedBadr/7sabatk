// إعدادات Supabase العامة فقط. Publishable key مخصص للاستخدام في المتصفح مع تفعيل RLS.
// لا تضع أبدًا Secret key أو service_role أو كلمة مرور قاعدة البيانات هنا.
export const SUPABASE_URL = "https://lkxmdrxfdrlbppkairik.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XYiM-z6rllWQMyCc0qtILg_HrITfRZi";
export const isSupabaseConfigured = !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR");
