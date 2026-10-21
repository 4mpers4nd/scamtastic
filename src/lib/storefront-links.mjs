const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

export function validProductId(value) {
  return typeof value === 'string' && PRODUCT_ID_PATTERN.test(value) ? value : null;
}

export function creatorStoreHref(username, productId) {
  const query = new URLSearchParams({ tab: 'store', product: productId });
  return `/profile/${encodeURIComponent(username)}?${query.toString()}`;
}

export function marketplaceProductHref(productId, creatorUsername) {
  const query = new URLSearchParams({
    product: productId,
    creator: creatorUsername,
  });
  return `/marketplace?${query.toString()}`;
}
