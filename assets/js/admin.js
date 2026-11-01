import {supabase,isSupabaseConfigured} from './backend.js';
import {translations} from './site-copy.js';
const $=s=>document.querySelector(s);const OWNER_ADMIN_ID='be398df3-3918-46e1-abc4-59975ffe716b';let currentUser=null,listings=[],fieldDefinitions=[],fieldPlatformStates=[],selectedFieldPlatform='TikTok',productFieldDraft={};
const toast=message=>{const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),3000)};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const platformKey=value=>String(value||'').trim().toLocaleLowerCase().replace(/\s+/g,' ');
function isFieldActiveForPlatform(field,platform=selectedFieldPlatform){
 const key=platformKey(platform);
 const override=fieldPlatformStates.find(x=>Number(x.field_id)===Number(field.id)&&x.platform_key===key);
 return override?override.is_active:field.is_active;
}
function currentProductPlatform(){return $('#productForm [name="category"]')?.value||'TikTok';}
function renderCustomInputs(values={}){
 productFieldDraft={...productFieldDraft,...values};
 const platform=platformKey(currentProductPlatform());
 $('#customProductFields').innerHTML=fieldDefinitions.filter(f=>isFieldActiveForPlatform(f,platform)).map(f=>{
  const numeric=f.field_type==='number';
  const value=productFieldDraft[f.field_key]??'';
  return `<label>${esc(f.label_ar)}<input data-custom-key="${esc(f.field_key)}" type="${numeric?'number':'text'}" ${numeric?'min="0" step="1"':''} value="${esc(value)}" maxlength="120"></label>`;
 }).join('');
}
function refreshPlatformOptions(){
 const input=$('#fieldPlatform');
 if(!input)return;
 const names=[...new Set([...listings.map(x=>x.category),...fieldPlatformStates.map(x=>x.platform_key)].filter(Boolean))];
 const list=$('#fieldPlatformOptions');
 if(list)list.innerHTML=names.map(x=>`<option value="${esc(x)}"></option>`).join('');
}

function showSection(name){document.querySelectorAll('.admin-section').forEach(s=>s.classList.toggle('active',s.id===`section-${name}`));document.querySelectorAll('.side-link').forEach(b=>b.classList.toggle('active',b.dataset.section===name));if(name==='products'){loadListings();loadFields();}if(name==='site')loadSettings();if(name==='users')loadUsers();}
document.querySelectorAll('[data-section]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.section)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showSection(b.dataset.go)));
async function requireAdmin(){if(!isSupabaseConfigured){document.body.innerHTML='<main class="container" style="padding:80px 20px;text-align:center"><h1>إعداد Supabase مطلوب</h1><a href="index.html">العودة للموقع</a></main>';return false;}const {data:{session},error}=await supabase.auth.getSession();if(error||!session){location.href='index.html';return false;}currentUser=session.user;const {data:profile,error:profileError}=await supabase.from('profiles').select('role,full_name,is_banned').eq('id',currentUser.id).single();if(profileError||profile?.role!=='admin'||profile?.is_banned||currentUser.id!==OWNER_ADMIN_ID){document.body.innerHTML='<main class="container" style="padding:80px 20px;text-align:center"><h1>غير مصرح بالدخول</h1><p>هذه الصفحة مخصصة لمدير الموقع فقط.</p><a href="index.html">العودة للموقع</a></main>';return false;}$('#adminIdentity').textContent=profile.full_name||currentUser.email;return true;}
async function loadListings(){const {data,error}=await supabase.from('listings').select('*').order('created_at',{ascending:false});if(error){toast(error.message);return;}listings=data||[];$('#productsTable').innerHTML=listings.length?listings.map(p=>`<tr><td><div class="table-product"><span class="table-thumb">${p.image_url?`<img class="table-thumb" src="${esc(p.image_url)}" alt="">`:'7S'}</span><span>${esc(p.title)}</span></div></td><td>${esc(p.category||'—')}</td><td>${Number(p.price_kwd||0).toFixed(3)} KWD</td><td><span class="status-pill ${p.status!=='published'?'off':''}">${p.status==='published'?'منشور':p.status==='archived'?'مؤرشف':'مسودة'}</span></td><td><div class="table-actions"><button data-edit="${p.id}">تعديل</button><button data-toggle="${p.id}">${p.status==='published'?'إخفاء':'نشر'}</button><button class="danger" data-delete="${p.id}">حذف</button></div></td></tr>`).join(''):'<tr><td colspan="5">لا توجد منتجات حتى الآن.</td></tr>';$('#statProducts').textContent=listings.length;$('#statPublished').textContent=listings.filter(p=>p.status==='published').length;$('#productsTable').querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>editListing(b.dataset.edit)));$('#productsTable').querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>toggleListing(b.dataset.toggle)));$('#productsTable').querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteListing(b.dataset.delete)));}

async function loadFields(){
 const [{data:fields,error:fieldError},{data:states,error:stateError}]=await Promise.all([
  supabase.from('listing_fields').select('*').order('sort_order'),
  supabase.from('listing_field_platforms').select('field_id,platform_key,is_active')
 ]);
 if(fieldError||stateError){
  fieldDefinitions=[];fieldPlatformStates=[];
  $('#fieldsTable').innerHTML=`<tr><td colspan="5">${esc((fieldError||stateError).message)} — تأكد من تشغيل SQL الخاص بتخصيص الحقول حسب المنصة.</td></tr>`;
  return;
 }
 fieldDefinitions=fields||[];fieldPlatformStates=states||[];
 refreshPlatformOptions();
 const platform=platformKey(selectedFieldPlatform);
 $('#fieldsTable').innerHTML=fieldDefinitions.map((f,i)=>{
  const active=isFieldActiveForPlatform(f,platform);
  return `<tr><td>${esc(f.label_ar)} / ${esc(f.label_en)}</td><td>${esc(f.field_key)}</td><td><input class="field-scope-input" data-field-scope="${f.id}" value="${esc(f.platform_key||'*')}" aria-label="نطاق الحقل" title="اكتب * لكل المنصات أو اسم منصة مثل PUBG أو TikTok"></td><td>${f.field_type==='number'?'رقم':'نص'} · ${active?'نشط في '+esc(selectedFieldPlatform):'متوقف في '+esc(selectedFieldPlatform)}</td><td><div class="table-actions"><button data-field-scope-save="${f.id}">حفظ النطاق</button><button data-field-up="${f.id}" ${i===0?'disabled':''}>↑</button><button data-field-down="${f.id}" ${i===fieldDefinitions.length-1?'disabled':''}>↓</button><button data-field-toggle="${f.id}">${active?'تعطيل لهذه المنصة':'تفعيل لهذه المنصة'}</button><button data-field-edit="${f.id}">تعديل</button><button class="danger" data-field-delete="${f.id}">حذف</button></div></td></tr>`;
 }).join('')||'<tr><td colspan="5">لا توجد حقول مخصصة.</td></tr>';
 renderCustomInputs();
 $('#fieldsTable').querySelectorAll('[data-field-toggle]').forEach(b=>b.addEventListener('click',async()=>{
  const field=fieldDefinitions.find(f=>String(f.id)===b.dataset.fieldToggle);if(!field)return;
  const platform_key=platformKey(selectedFieldPlatform),is_active=!isFieldActiveForPlatform(field,platform_key);
  const {error}=await supabase.from('listing_field_platforms').upsert({field_id:field.id,platform_key,is_active},{onConflict:'field_id,platform_key'});
  if(error)toast(error.message);else await loadFields();
 }));
 $('#fieldsTable').querySelectorAll('[data-field-scope-save]').forEach(b=>b.addEventListener('click',async()=>{
  const id=b.dataset.fieldScopeSave,input=$(`#fieldsTable [data-field-scope="${id}"]`);
  const scope=input?.value.trim()||'*';
  const {error}=await supabase.from('listing_fields').update({platform_key:scope==='*'?'*':platformKey(scope)}).eq('id',id);
  if(error)toast(error.message);else{toast('تم حفظ نطاق الحقل');await loadFields();}
 }));
 $('#fieldsTable').querySelectorAll('[data-field-edit]').forEach(b=>b.addEventListener('click',()=>editField(b.dataset.fieldEdit)));
 $('#fieldsTable').querySelectorAll('[data-field-delete]').forEach(b=>b.addEventListener('click',()=>deleteField(b.dataset.fieldDelete)));
 $('#fieldsTable').querySelectorAll('[data-field-up],[data-field-down]').forEach(b=>b.addEventListener('click',async()=>{
  const id=b.dataset.fieldUp||b.dataset.fieldDown,index=fieldDefinitions.findIndex(f=>String(f.id)===id),target=index+(b.dataset.fieldUp?-1:1);
  if(index<0||target<0||target>=fieldDefinitions.length)return;
  const current=fieldDefinitions[index],other=fieldDefinitions[target];
  const {error}=await supabase.from('listing_fields').upsert([
   {id:current.id,field_key:current.field_key,label_ar:current.label_ar,label_en:current.label_en,field_type:current.field_type,is_active:current.is_active,sort_order:other.sort_order},
   {id:other.id,field_key:other.field_key,label_ar:other.label_ar,label_en:other.label_en,field_type:other.field_type,is_active:other.is_active,sort_order:current.sort_order}
  ],{onConflict:'id'});
  if(error)toast(error.message);else loadFields();
 }));
}
function openProductForm(item=null){const form=$('#productForm');form.hidden=false;form.reset();form.elements.id.value=item?.id||'';$('#productFormTitle').textContent=item?'تعديل المنتج':'إضافة منتج جديد';for(const [field,key] of Object.entries({title:'title',username:'username',category:'category',price_kwd:'price_kwd',description:'description'})){if(form.elements[field])form.elements[field].value=item?.[key]??(field==='category'?'TikTok':'');}form.elements.image_url.value=item?.image_url||'';form.elements.is_published.checked=item?item.status==='published':true;productFieldDraft={...(item?.custom_fields||{}),followers_count:item?.followers_count??item?.custom_fields?.followers_count,views_count:item?.views_count??item?.custom_fields?.views_count};renderCustomInputs();form.scrollIntoView({behavior:'smooth',block:'start'});}
function editListing(id){const item=listings.find(x=>String(x.id)===String(id));if(item)openProductForm(item);}
$('#newProduct').addEventListener('click',()=>openProductForm());$('#newProductTop').addEventListener('click',()=>{showSection('products');openProductForm();});$('#cancelProduct').addEventListener('click',()=>$('#productForm').hidden=true);
$('#productForm [name="category"]').addEventListener('change',()=>{
 $('#customProductFields').querySelectorAll('[data-custom-key]').forEach(input=>{productFieldDraft[input.dataset.customKey]=input.value;});
 renderCustomInputs();
});

$('#productForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,fd=new FormData(form),id=fd.get('id'),msg=$('#productMessage');msg.textContent='جارٍ الحفظ...';let imageUrl=fd.get('image_url')||listings.find(p=>String(p.id)===String(id))?.image_url||null;const file=fd.get('image');try{if(file&&file.size){if(file.size>5*1024*1024)throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('الصور المسموحة: JPG وPNG وWEBP فقط.');const ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1],path=`${crypto.randomUUID()}.${ext}`;const {error:uploadError}=await supabase.storage.from('listing-images').upload(path,file,{upsert:false,contentType:file.type});if(uploadError)throw uploadError;imageUrl=supabase.storage.from('listing-images').getPublicUrl(path).data.publicUrl;}const custom_fields={...productFieldDraft};$('#customProductFields').querySelectorAll('[data-custom-key]').forEach(input=>{if(input.value.trim())custom_fields[input.dataset.customKey]=input.type==='number'?Number(input.value):input.value.trim();else delete custom_fields[input.dataset.customKey];});const record={title:fd.get('title').trim(),username:fd.get('username').trim()||null,category:fd.get('category').trim()||'Other',price_kwd:Number(fd.get('price_kwd')),followers_count:custom_fields.followers_count!==undefined?Number(custom_fields.followers_count):0,views_count:custom_fields.views_count!==undefined?Number(custom_fields.views_count):0,custom_fields,description:fd.get('description').trim()||null,image_url:imageUrl,status:form.elements.is_published.checked?'published':'draft'};const result=id?await supabase.from('listings').update(record).eq('id',id):await supabase.from('listings').insert(record);if(result.error)throw result.error;msg.textContent='تم حفظ المنتج.';form.hidden=true;toast('تم حفظ المنتج بنجاح');await loadListings();}catch(error){msg.textContent=error.message||'تعذر الحفظ.';}});
async function toggleListing(id){const item=listings.find(x=>String(x.id)===String(id));if(!item)return;const {error}=await supabase.from('listings').update({status:item.status==='published'?'draft':'published'}).eq('id',id);if(error)toast(error.message);else{toast('تم تحديث حالة المنتج');loadListings();}}
async function deleteListing(id){if(!confirm('هل أنت متأكد من حذف هذا المنتج نهائيًا؟'))return;const {error}=await supabase.from('listings').delete().eq('id',id);if(error)toast(error.message);else{toast('تم حذف المنتج');loadListings();}}

$('#fieldPlatform')?.addEventListener('change',async()=>{
 selectedFieldPlatform=$('#fieldPlatform').value.trim()||'TikTok';
 await loadFields();
});
$('#fieldForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),ar=String(fd.get('label_ar')).trim(),en=String(fd.get('label_en')).trim(),slug=en.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')||`field_${Date.now()}`,baseKey=`extra_${slug}`,field_key=fieldDefinitions.some(f=>f.field_key===baseKey)?`${baseKey}_${Date.now()}`:baseKey;const {error}=await supabase.from('listing_fields').insert({field_key,label_ar:ar,label_en:en,field_type:fd.get('field_type')||'number',platform_key:platformKey(selectedFieldPlatform),is_active:true,sort_order:100+fieldDefinitions.length});if(error){toast(error.message);return;}e.currentTarget.reset();toast('تمت إضافة الحقل');await loadFields();});
async function updateField(id,patch){const {error}=await supabase.from('listing_fields').update(patch).eq('id',id);if(error)toast(error.message);else loadFields();}
async function editField(id){const f=fieldDefinitions.find(x=>String(x.id)===String(id));if(!f)return;const ar=prompt('اسم الحقل بالعربية',f.label_ar);if(ar===null)return;const en=prompt('اسم الحقل بالإنجليزية',f.label_en);if(en===null)return;const type=prompt('نوع البيانات: number أو text',f.field_type||'number');if(type===null)return;if(!['number','text'].includes(type.trim())){toast('نوع البيانات يجب أن يكون number أو text');return;}const {error}=await supabase.from('listing_fields').update({label_ar:ar.trim(),label_en:en.trim(),field_type:type.trim()}).eq('id',id);if(error)toast(error.message);else loadFields();}
async function deleteField(id){if(!confirm('حذف تعريف الحقل؟ القيم القديمة ستظل محفوظة داخل المنتجات لكنها لن تظهر.'))return;const {error}=await supabase.from('listing_fields').delete().eq('id',id);if(error)toast(error.message);else loadFields();}
function renderSiteTextFields(language,overrides={}){const container=$(`#siteTextFields${language==='ar'?'Ar':'En'}`);if(!container)return;const dictionary=translations[language]||{};container.innerHTML=Object.entries(dictionary).map(([key,defaultValue])=>{const value=Object.prototype.hasOwnProperty.call(overrides,key)?overrides[key]:defaultValue;const long=/Text|Sub|Welcome|Invalid|Mismatch|Taken/i.test(key)||String(value).length>90;return `<label class="site-text-field" data-search="${esc(key+' '+value+' '+defaultValue).toLocaleLowerCase()}"><span>${esc(key)}</span>${long?`<textarea data-copy-lang="${language}" data-copy-key="${esc(key)}" rows="2">${esc(value)}</textarea>`:`<input data-copy-lang="${language}" data-copy-key="${esc(key)}" value="${esc(value)}">`}<small>الافتراضي: ${esc(defaultValue)}</small></label>`;}).join('');}
async function loadSettings(){const {data,error}=await supabase.from('site_settings').select('key,value');if(error){toast(error.message);return;}const values=Object.fromEntries((data||[]).map(x=>[x.key,x.value]));const f=$('#siteForm');for(const [key,value] of Object.entries(values)){const field=f.elements[key];if(field){if(field.type==='checkbox')field.checked=(value===true||value==='true'||value===1);else field.value=value??'';}}$('#statCurrency').textContent=values.default_currency||'KWD';renderSiteTextFields('ar',values.site_text_ar||{});renderSiteTextFields('en',values.site_text_en||{});}
$('#siteForm').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,fd=new FormData(f),keys=['site_name','default_currency','whatsapp_number','contact_email','announcement_text_ar','announcement_text_en','announcement_style','default_language'];const rows=keys.filter(k=>f.elements[k]).map(key=>({key,value:fd.get(key)||''}));rows.push({key:'announcement_enabled',value:f.elements.announcement_enabled.checked},{key:'maintenance_mode',value:f.elements.maintenance_mode.checked},{key:'show_unavailable',value:f.elements.show_unavailable.checked});const {error}=await supabase.from('site_settings').upsert(rows,{onConflict:'key'});$('#siteMessage').textContent=error?error.message:'تم حفظ إعدادات الموقع.';if(!error){toast('تم حفظ الإعدادات');$('#statCurrency').textContent=f.elements.default_currency.value;}});
$('#siteTextSearch')?.addEventListener('input',e=>{const q=e.target.value.trim().toLocaleLowerCase();document.querySelectorAll('.site-text-field').forEach(el=>el.hidden=!!q&&!el.dataset.search.includes(q));});
$('#saveSiteTexts').addEventListener('click',async()=>{const message=$('#siteTextsMessage');try{const collect=lang=>Object.fromEntries([...document.querySelectorAll(`[data-copy-lang="${lang}"]`)].map(el=>[el.dataset.copyKey,el.value]));const ar=collect('ar'),en=collect('en');message.textContent='جارٍ حفظ النصوص...';const {error}=await supabase.from('site_settings').upsert([{key:'site_text_ar',value:ar},{key:'site_text_en',value:en}],{onConflict:'key'});if(error)throw error;message.textContent='تم حفظ النصوص بنجاح. حدّث الموقع لرؤية التغييرات.';toast('تم حفظ نصوص الموقع');}catch(error){message.textContent='خطأ: '+error.message;}});
async function adminAction(action,userId,extra={}){const {data,error}=await supabase.functions.invoke('admin-users',{body:{action,userId,...extra}});if(error)throw error;if(data?.error)throw new Error(data.error);return data;}
async function loadUsers(){let data;try{data=await adminAction('list_users');}catch(error){$('#usersTable').innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return;}$('#statUsers').textContent=(data||[]).length;$('#usersTable').innerHTML=(data||[]).map(u=>`<tr><td>${esc(u.email||'—')}</td><td>${esc(u.full_name||u.username||'—')}<br><small>@${esc(u.username||'—')}</small></td><td>${u.role==='admin'?'مدير':'مستخدم'} · ${u.is_banned?'محظور':'نشط'}</td><td>${u.created_at?new Date(u.created_at).toLocaleDateString('ar'):'—'}</td><td>${u.id===OWNER_ADMIN_ID?'<span class="status-pill">مالك الموقع — محمي</span>':`<div class="table-actions"><button data-user-role="${u.id}">${u.role==='admin'?'إزالة الإدارة':'ترقية لمدير'}</button><button data-user-ban="${u.id}">${u.is_banned?'إلغاء الحظر':'حظر نهائي'}</button><button data-user-email="${u.id}">تغيير البريد</button><button data-user-password="${u.id}">تغيير كلمة المرور</button><button class="danger" data-user-delete="${u.id}">حذف</button></div>`}</td></tr>`).join('')||'<tr><td colspan="5">لا يوجد مستخدمون.</td></tr>';
 $('#usersTable').querySelectorAll('[data-user-role]').forEach(b=>b.addEventListener('click',async()=>{const u=data.find(x=>x.id===b.dataset.userRole);if(!u||!confirm('تأكيد تغيير صلاحية المستخدم؟'))return;try{await adminAction('set_role',u.id,{role:u.role==='admin'?'user':'admin'});toast('تم تحديث الصلاحية');loadUsers();}catch(e){toast(e.message);}}));
 $('#usersTable').querySelectorAll('[data-user-ban]').forEach(b=>b.addEventListener('click',async()=>{const u=data.find(x=>x.id===b.dataset.userBan);if(!u||!confirm(u.is_banned?'إلغاء حظر هذا المستخدم؟':'حظر هذا المستخدم نهائيًا؟'))return;try{await adminAction(u.is_banned?'unban':'ban',u.id);toast('تم تحديث حالة المستخدم');loadUsers();}catch(e){toast(e.message);}}));
 $('#usersTable').querySelectorAll('[data-user-email]').forEach(b=>b.addEventListener('click',async()=>{const u=data.find(x=>x.id===b.dataset.userEmail);if(!u)return;const email=prompt('أدخل البريد الإلكتروني الجديد',u.email||'');if(!email)return;try{await adminAction('update_email',u.id,{email});toast('تم تغيير البريد');loadUsers();}catch(e){toast(e.message);}}));
 $('#usersTable').querySelectorAll('[data-user-password]').forEach(b=>b.addEventListener('click',()=>{$('#adminPasswordUserId').value=b.dataset.userPassword;$('#adminNewPassword').value='';$('#adminPasswordMessage').textContent='';document.querySelectorAll('.overlay').forEach(x=>x.classList.remove('open'));$('#adminPasswordDialog').classList.add('open');}));
 $('#usersTable').querySelectorAll('[data-user-delete]').forEach(b=>b.addEventListener('click',async()=>{const u=data.find(x=>x.id===b.dataset.userDelete);if(!u||!confirm('حذف المستخدم نهائيًا؟ لا يمكن التراجع عن ذلك.'))return;try{await adminAction('delete',u.id);toast('تم حذف المستخدم');loadUsers();}catch(e){toast(e.message);}}));}
$('#adminPasswordForm').addEventListener('submit',async e=>{e.preventDefault();const userId=$('#adminPasswordUserId').value,password=$('#adminNewPassword').value;if(password.length<8){$('#adminPasswordMessage').textContent='استخدم 8 أحرف على الأقل.';return;}$('#adminPasswordMessage').textContent='جارٍ التحديث...';try{await adminAction('update_password',userId,{password});$('#adminPasswordMessage').textContent='تم تغيير كلمة المرور بنجاح.';toast('تم تغيير كلمة المرور');setTimeout(()=>$('#adminPasswordDialog').classList.remove('open'),1000);}catch(err){$('#adminPasswordMessage').textContent=err.message;}});
$('#adminPasswordDialog [data-close]').addEventListener('click',()=>$('#adminPasswordDialog').classList.remove('open'));
$('#adminSignOut').addEventListener('click',async()=>{await supabase.auth.signOut();location.href='index.html';});
if(await requireAdmin()){await loadListings();await loadSettings();await loadUsers();await loadFields();}
