# Social services and wallet setup

1. Open the Supabase project SQL Editor.
2. Run `migration_social_commerce.sql` once. It creates the TikTok and Instagram categories, the eight requested starter services, secure checkout/wallet functions, row-level policies, and owner wallet credit.
3. Open the site admin panel and choose **الخدمات الاجتماعية والرصيد**.
4. Edit each service and set its price per 1,000 units in KWD, along with its quantity limits. Starter prices are `0` so no service can be accidentally purchased before you set a price.
5. Use the same admin section to add categories/services, review orders, and credit test or customer balances. Credits are recorded in the wallet transaction ledger.
6. Deploy the static site after the SQL migration has completed.

Customers must be signed in to use the cart, view their balance, and check out. Checkout recalculates prices and validates quantities on the server, locks the balance, creates the order, records the ledger entry, and deducts the balance atomically.

Apple Pay, PayPal, and Binance top-ups are not enabled yet. The customer UI labels top-up as coming soon; only the owner can add balance manually in this version. Order status changes do not automatically issue refunds.
