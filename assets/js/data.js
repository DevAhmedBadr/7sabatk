import { supabase, isSupabaseConfigured } from "./backend.js";

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
  const {data,error}=await supabase.from("site_settings").select("key,value");
  if(error) { console.warn("Settings fallback",error); return {}; }
  return Object.fromEntries((data||[]).map(row=>[row.key,row.value]));
}
