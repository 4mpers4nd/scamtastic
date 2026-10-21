import Header from '@/components/Header';
import ProductBrowser from '@/components/storefront/ProductBrowser';
import { emptyPublishedProducts } from '@/lib/storefront';
import { validProductId } from '@/lib/storefront-links.mjs';
import { profileUsernameFromRouteParam } from '@/lib/profile-route.mjs';

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    product?: string | string[];
    creator?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawProductId = Array.isArray(params.product) ? params.product[0] : params.product;
  const rawCreator = Array.isArray(params.creator) ? params.creator[0] : params.creator;
  const productId = validProductId(rawProductId);
  const creatorUsername = profileUsernameFromRouteParam(rawCreator);

  return (
    <>
      <Header />
      <main className="marketplacePage">
        <header className="marketplaceHeading">
          <div className="tag">// SCAMTASTIC MARKETPLACE</div>
          <h1>Creations for your network.</h1>
          <p>
            Discover software, games, tools, and visual customizations published by Scamtastic creators.
          </p>
        </header>
        <ProductBrowser
          products={emptyPublishedProducts}
          mode="marketplace"
          initialProductId={productId}
          profileUsername={creatorUsername ?? undefined}
        />
      </main>
    </>
  );
}
