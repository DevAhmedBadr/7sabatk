// Privacy-conscious, best-effort device deduplication for anonymous and signed-in visitors.
// FingerprintJS is probabilistic: browsers/devices can still be misidentified.
import {supabase,isSupabaseConfigured} from './backend.js';

const STORAGE_KEY='7sabatk_visitor_id_v1';
const HASH_SALT='7sabatk-public-visitor-analytics-v1';
async function sha256(value){
 const bytes=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function getVisitorHash(){
 try{
  const saved=localStorage.getItem(STORAGE_KEY);
  if(saved&&/^[a-f0-9]{64}$/.test(saved))return saved;
  const {default:FingerprintJS}=await import('https://openfpcdn.io/fingerprintjs/v4');
  const agent=await FingerprintJS.load();
  const result=await agent.get();
  const hashed=await sha256(`${HASH_SALT}:${result.visitorId}`);
  try{localStorage.setItem(STORAGE_KEY,hashed);}catch{}
  return hashed;
 }catch(error){
  // Stable same-browser fallback when fingerprinting is blocked.
  let fallback='';
  try{fallback=localStorage.getItem('7sabatk_visitor_fallback_v1')||'';}catch{}
  if(!fallback){
   fallback=`fallback:${crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`}`;
   try{localStorage.setItem('7sabatk_visitor_fallback_v1',fallback);}catch{}
  }
  const hashed=await sha256(`${HASH_SALT}:${fallback}`);
  try{localStorage.setItem(STORAGE_KEY,hashed);}catch{}
  return hashed;
 }
}
async function recordVisit(){
 if(!isSupabaseConfigured||!supabase)return;
 try{
  const visitor_hash=await getVisitorHash();
  const {error}=await supabase.rpc('record_site_visit',{p_visitor_hash:visitor_hash});
  if(error)console.warn('Visitor analytics could not record this visit:',error.message);
 }catch(error){console.warn('Visitor analytics unavailable:',error);}
}
if(!/\/admin(?:\.html)?\/?$/i.test(location.pathname))recordVisit();
