import { supabase, isSupabaseConfigured } from "./backend.js";

export async function loadAccounts(){
  if(isSupabaseConfigured){
    const {data,error}=await supabase.from("listings").select("*").eq("status","published").order("created_at",{ascending:false});
    if(error) throw error;
    return (data||[]).map(row=>({
      ...row,
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

export async function loadPublicSettings(){
  if(!isSupabaseConfigured) return {};
  const {data,error}=await supabase.from("site_settings").select("key,value");
  if(error) { console.warn("Settings fallback",error); return {}; }
  return Object.fromEntries((data||[]).map(row=>[row.key,row.value]));
}
