import { supabase, isSupabaseConfigured } from "./backend.js";

const PUBLIC_SETTINGS_CACHE_KEY = "7sabatk_public_settings_cache_v1";
let publicSettingsRefresh;

export function getCachedPublicSettings() {
  try {
    const cached = JSON.parse(localStorage.getItem(PUBLIC_SETTINGS_CACHE_KEY) || "null");
    return cached?.settings && typeof cached.settings === "object" ? cached.settings : {};
  } catch {
    return {};
  }
}

export function cachePublicSettings(settings) {
  if (!settings || typeof settings !== "object") return;
  try { localStorage.setItem(PUBLIC_SETTINGS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), settings })); } catch {}
}

function isMissingProductTypeColumn(error){
  const message=String(error?.message||'').toLowerCase();
  return error?.code==='42703' || error?.code==='PGRST204' || (message.includes('product_type') && (message.includes('does not exist') || message.includes('schema cache')));
}

export async function loadAccounts(){
  if(isSupabaseConfigured){
    let result=await supabase.from("listings").select("*").eq("status","published").eq("product_type","account").order("created_at",{ascending:false});
    // Backward-compatible recovery: before the subscription migration is run,
    // all existing published listings are still accounts and must remain visible.
    if(result.error && isMissingProductTypeColumn(result.error)){
      console.warn('product_type is not installed yet; loading published listings as accounts. Run supabase/migration_subscriptions.sql to enable subscriptions.');
      result=await supabase.from("listings").select("*").eq("status","published").order("created_at",{ascending:false});
    }
    if(result.error) throw result.error;
    return (result.data||[]).map(row=>({
      ...row,
      product_type: row.product_type || 'account',
      followers: row.followers_count ?? 0,
      average_views: row.views_count ?? 0,
      is_published: row.status === "published",
      is_available: row.status !== "archived"
    }));
  }
  const response=await fetch("data/accounts.json",{cache:"no-store"});
  if(!response.ok) throw new Error(`تعذر تحميل البيانات: ${response.status}`);
  const data=await response.json(); return Array.isArray(data.accounts)?data.accounts:[];
}


export async function loadSubscriptions(){
  if(isSupabaseConfigured){
    const {data,error}=await supabase.from("listings").select("*").eq("status","published").eq("product_type","subscription").order("created_at",{ascending:false});
    if(error && isMissingProductTypeColumn(error)) return [];
    if(error) throw error;
    return data||[];
  }
  return [];
}

export async function loadPublicSettings(){
  if(!isSupabaseConfigured) return {};
  let cachedAt = 0;
  try { cachedAt = Number(JSON.parse(localStorage.getItem(PUBLIC_SETTINGS_CACHE_KEY) || "null")?.savedAt) || 0; } catch {}
  const cached = getCachedPublicSettings();
  const freshEnough = cachedAt && Date.now() - cachedAt < 30_000;
  if (freshEnough) return cached;

  // Keep the last known settings available immediately between page navigations,
  // while refreshing them in the background so language and header text do not flash.
  if (Object.keys(cached).length) {
    publicSettingsRefresh ||= supabase.from("site_settings").select("key,value").then(({data,error})=>{
      if(error) throw error;
      const settings = Object.fromEntries((data||[]).map(row=>[row.key,row.value]));
      cachePublicSettings(settings);
      return settings;
    }).catch(error=>{ console.warn("Settings refresh fallback",error); return cached; }).finally(()=>{ publicSettingsRefresh = null; });
    return cached;
  }

  const {data,error}=await supabase.from("site_settings").select("key,value");
  if(error) { console.warn("Settings fallback",error); return {}; }
  const settings = Object.fromEntries((data||[]).map(row=>[row.key,row.value]));
  cachePublicSettings(settings);
  return settings;
}
