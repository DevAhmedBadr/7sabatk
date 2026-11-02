# 7sabatk — Release notes

## Improvements in this package

- Reworked the storefront and admin visual styling with a new marketplace-focused teal/navy visual system and responsive layouts.
- Kept Arabic/English automatic device-language detection and language override.
- Expanded personal preferences: currency, theme, number format, reduced motion, compact cards, reference visibility and image-fit selection.
- Added full-size image preview and kept `contain` as the default so uploaded account screenshots are not cropped.
- Expanded the account profile with display name, unique username, email confirmation, profile photo upload and password recovery by email OTP.
- Added a forgot-password action directly in the sign-in dialog.
- Fixed the owner dashboard shortcut so it is shown for the configured owner account; the dashboard still independently checks the owner UUID and database admin role.
- Made listing statistics use the active dynamic field definitions in both cards and detail views.
- Added custom field data types and ordering controls.
- Hardened the database migration: owner-only listing/site-settings/field writes, safe profile column grants, profile email triggers and isolated avatar storage uploads.
- Hardened the `admin-users` Edge Function and protected the owner account from customer-management actions.

## Verification performed

- JavaScript syntax checked with Node.js.
- HTML parsed and duplicate IDs checked.
- CSS parsed with tinycss2; no CSS parse errors remain.
- Static selector-to-HTML ID checks passed.

## Actions still required in the live project

This ZIP does not modify GitHub or Supabase automatically. After uploading the repository:
1. Back up the existing Supabase database.
2. Run `supabase/migration_marketplace_v2.sql` in the existing project's SQL Editor.
3. Deploy `supabase/functions/admin-users` with the Supabase CLI.
4. Verify Authentication URL Configuration and email templates.
5. Test signup, email confirmation, forgot password OTP, profile edits, avatar upload, owner dashboard, listing CRUD, dynamic fields, user ban/unban, email/password admin updates and user deletion against the live project.

A static source check cannot prove live SMTP delivery, live database-policy behavior or Edge Function deployment. Those require testing against the actual Supabase project.

## Hero banner and image loading update
- Moved the Arabic/English promotional banner into the hero artwork area beside the main text.
- Converted the logo and both banners from large PNG files to optimized WebP assets.
- Preloaded the logo and both language banners for faster first paint.
- Prioritized the first six marketplace card images and left later cards lazy-loaded to avoid downloading the entire catalog before the visitor needs it.


## Site-wide controls update
- Added an optional clickable URL to the bilingual announcement board.
- Moved announcement styling into the public stylesheet so the banner is styled on the actual website.
- Improved announcement visibility handling and multiline text rendering.
- Kept the global default-language setting and bilingual site-copy editor; clarified the scope of editable UI text.


## Automatic HTML text editor
- The admin text editor now fetches the currently published `index.html` and discovers its static text nodes and common text attributes automatically.
- Newly added or removed HTML text is reflected when the admin settings editor is reopened after the updated site is published.
- Arabic and English values are saved in the `site_html_texts` setting and applied to matching elements on the public page.
- Text created dynamically by JavaScript, product descriptions, and content loaded from Supabase are not static HTML and remain managed by their respective features.


## Digital services expansion
- Added a three-way service chooser on the home page: accounts, social-media services, and subscriptions.
- Added a bilingual social-media services coming-soon page.
- Added a subscription catalog with account-style product cards and detail/contact flow.
- Added a product type selector in Admin → Product Management so subscriptions can be created, edited, published, hidden, and deleted separately from accounts.
- Added `supabase/migration_subscriptions.sql` to safely classify existing listings as accounts and enable subscription records.

## Dedicated category pages and legacy listing recovery
- The home page now acts as a category selector instead of stacking the catalog sections vertically.
- Added dedicated pages: `accounts.html`, `social-services.html`, and `subscriptions.html`.
- Existing published listings remain visible as accounts if the database migration has not yet added `listings.product_type`.
- Run `supabase/migration_subscriptions.sql` in Supabase SQL Editor to enable subscription listings and administration.
