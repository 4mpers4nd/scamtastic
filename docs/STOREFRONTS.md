# Creator storefronts and marketplace

## Current UI

- A creator's store is available at `/profile/[username]?tab=store`.
- The global discovery page is available at `/marketplace`.
- Profile/store links encode usernames, so names such as `Ampers&` remain a single URL segment.
- Product selection uses the `product` query parameter. Store links use
  `/profile/[username]?tab=store&product=[id]`; marketplace modal state can be
  represented by `/marketplace?product=[id]&creator=[username]`.
- Closing a product dialog removes its query parameters and leaves the current
  browsing page in place. The native modal dialog supports Escape and backdrop
  dismissal, and keeps keyboard focus within the dialog while open.

## Backend status

The existing database migrations contain no publishable-product catalog, assets,
categories, ownership, or purchase functions. The storefront and marketplace
therefore receive a typed empty `StoreProduct[]` and show intentional empty
states. They do not display sample products, infer inventory from unrelated
tables, or claim that search, category filters, and purchases work.

`src/lib/storefront.ts` is only the typed UI contract for future published
product data. `ProductBrowser` can render cards and URL-selected detail dialogs
once a reviewed, RLS-protected public catalog API is available. Until then the
purchase control is disabled and no Bits balances or transactions are created.

No database migration was created or applied for this UI foundation. A future
publishing implementation must define reviewable publication/version and asset
permissions before connecting product data. Purchases require a separate
server-side transactional design and auditable ledger; they are not part of this
feature.
