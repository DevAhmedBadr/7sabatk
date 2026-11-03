# 7sabatk — Digital Accounts Marketplace

A bilingual Arabic/English storefront for digital accounts owned and listed by the store owner. Visitors can browse listings; only the fixed owner account can create, edit, publish, hide or delete listings.

## Frontend files

- `index.html` — storefront, authentication, personal preferences, profile editor and account detail dialogs.
- `admin.html` — owner-only dashboard for listings, custom fields, site settings and user administration.
- `assets/css/marketplace-pro.css` — refreshed marketplace visual system and responsive refinements.
- `assets/js/supabaseClient.js` — public Supabase URL and publishable key only. Never add a service-role key here.
- `supabase/migration_marketplace_v2.sql` — additive upgrade for the existing Supabase project.
- `supabase/functions/admin-users/index.ts` — server-side user administration using the service-role key from Supabase's function environment.
- `supabase/email-templates/` — branded confirmation and OTP password-reset templates.

## Upgrade the existing Supabase project

Do not create a new project. Before applying database changes, export/backup the current database schema and data.

1. Open Supabase → SQL Editor.
2. Run `supabase/migration_marketplace_v2.sql` from this repository. It is designed to be re-runnable and keeps existing listings and user records. It resets policies on `profiles`, `listings`, `listing_fields` and `site_settings` to the intended rules: public read of published listings/settings/active fields, owner-only listing and settings writes, and self-only safe profile updates.
3. Confirm that the owner profile still has `role = 'admin'` and `is_banned = false`. The owner UUID used by this project is fixed in the migration and Edge Function.
4. Deploy the Edge Function from the repository root:

   ```bash
   supabase link --project-ref lkxmdrxfdrlbppkairik
   supabase functions deploy admin-users
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is read only from the Supabase Edge Function environment. Never copy it into the frontend, repository, ZIP, or GitHub.
5. In Supabase → Authentication → URL Configuration, keep:
   - Site URL: `https://devahmedbadr.github.io/7sabatk/`
   - Redirect URL allowlist: `https://devahmedbadr.github.io/7sabatk/`
6. In Authentication → Email Templates:
   - Confirm signup: use `supabase/email-templates/confirm-signup.html`.
   - Reset password: use `supabase/email-templates/reset-password-otp.html`.
7. Custom SMTP must be configured separately in Supabase. Do not commit SMTP passwords or Google App Passwords to this repository.
8. Push the updated repository to the `main` branch. Wait for the newest GitHub Pages workflow to complete successfully.

## Security model

- The browser uses only the public Supabase publishable key. RLS is the security boundary for database access.
- `public.is_admin()` requires both the fixed owner UUID and `profiles.role = 'admin'`; a different user cannot gain owner write privileges by changing a profile role.
- Listing, field-definition and site-setting writes are restricted by RLS to the owner.
- Profile clients can update only `full_name`, `username` and `avatar_url`; they cannot change `role`, `is_banned` or email copies in the profile table.
- Email changes use Supabase Auth and require the configured confirmation flow.
- Password changes from the user profile use the password-reset email OTP flow. Admin password resets use the server-side Edge Function.
- The `avatars` bucket is public-read, but uploads/updates/deletes are restricted to the authenticated user's own folder.
- The Edge Function authenticates the caller, checks the fixed owner UUID and admin role, and protects the owner account from customer-management actions.
- Do not store account passwords, recovery codes, or private platform credentials in listing descriptions or images. Only list accounts you are authorized to transfer under the relevant platform terms.

## Current storefront preferences

- Device-language detection on first visit, with Arabic/English override.
- Dark, light and system themes; display currency; number locale; reduced motion; compact cards; account-reference visibility; image fit.
- Listing images default to `contain` so full profile screenshots are visible; users can optionally choose `cover`. Images can be opened in a full-screen viewer.
- Account profile supports display name, unique username, email update confirmation, profile photo and password reset by email OTP.
- Account statistics are driven by `listing_fields`, including labels, type, active state and display order.


## Digital subscriptions catalog

The storefront now separates three service areas: digital accounts, social-media services (coming soon), and digital subscriptions. Subscription offers are stored in the existing `listings` table with `product_type = 'subscription'`; account records remain `product_type = 'account'`.

Before deploying this version, run `supabase/migration_subscriptions.sql` once in the Supabase SQL Editor. Then publish the updated project. In Admin → إدارة المنتجات, choose **اشتراك رقمي** when creating an offer; enter its title, category/platform (for example Netflix or YouTube), price, image, and description. Existing account listings are preserved and remain in the accounts catalog.

## Separate category pages
- `index.html`: home page and category selector.
- `accounts.html`: existing digital-account catalog.
- `social-services.html`: social-media services landing page (Coming Soon).
- `subscriptions.html`: digital subscriptions catalog.

### Enable subscriptions in an existing Supabase project
Run `supabase/migration_subscriptions.sql` once in the Supabase Dashboard → SQL Editor. The migration adds `listings.product_type` with a default of `account`, so existing listings stay classified as accounts. The frontend also has a compatibility fallback that continues showing published legacy listings as accounts until the migration is run.


## Visitor analytics (admin dashboard)

The admin overview includes unique-device visitor analytics with today / 7-day / 30-day / 12-month views.

1. Open Supabase Dashboard → SQL Editor.
2. Run `supabase/migration_visitor_analytics.sql` once.
3. Deploy the updated site to Cloudflare Workers.

The public pages load `assets/js/visitor-tracker.js`. It uses the open-source FingerprintJS browser library to generate a probabilistic device identifier, hashes that identifier with SHA-256, and sends only the hash to a restricted database function. Visitors do not need to sign in. The database stores one row per pseudonymous device per UTC hour; the admin-only RPC aggregates unique devices for each chart interval.

**Accuracy and privacy notes:** browser fingerprinting is probabilistic, not a guaranteed physical-device identity. Private browsing, browser updates, privacy extensions, VPNs, device setting changes, and different browsers can change the fingerprint; two similar devices can occasionally collide. A local browser storage fallback helps keep the same browser stable. The hash is pseudonymous data, not anonymous data in the strict legal sense. Update the privacy/cookie notice and assess applicable consent/GDPR requirements before production use. The visitor counter does not collect account identity, IP address, or raw fingerprint components.
