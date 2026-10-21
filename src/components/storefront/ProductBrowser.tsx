'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { profileHref } from '@/lib/profile-route.mjs';
import {
  creatorStoreHref,
  marketplaceProductHref,
  validProductId,
} from '@/lib/storefront-links.mjs';
import type { StoreProduct } from '@/lib/storefront';

function categoryLabel(category: StoreProduct['category']) {
  switch (category) {
    case 'game':
      return 'Game';
    case 'visual':
      return 'Visual';
    case 'tool':
      return 'Tool';
    case 'software':
      return 'Software';
  }
}

function selectedIdFromUrl() {
  return validProductId(new URL(window.location.href).searchParams.get('product'));
}

function safeThumbnail(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function ProductBrowser({
  products,
  mode,
  initialProductId,
  profileUsername,
}: {
  products: StoreProduct[];
  mode: 'profile' | 'marketplace';
  initialProductId: string | null;
  profileUsername?: string;
}) {
  const [selectedProductId, setSelectedProductId] = useState(initialProductId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function syncFromUrl() {
      setSelectedProductId(selectedIdFromUrl());
    }
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selectedProductId && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    } else if (!selectedProductId && dialog.open) {
      dialog.close();
    }
  }, [selectedProductId]);

  function setProductInUrl(productId: string | null, creatorUsername?: string) {
    const url = new URL(window.location.href);
    if (productId) {
      url.searchParams.set('product', productId);
      if (mode === 'marketplace' && creatorUsername) {
        url.searchParams.set('creator', creatorUsername);
      }
    } else {
      url.searchParams.delete('product');
      if (mode === 'marketplace') url.searchParams.delete('creator');
    }
    const nextUrl =
      mode === 'marketplace' && productId && creatorUsername
        ? marketplaceProductHref(productId, creatorUsername)
        : `${url.pathname}${url.search}${url.hash}`;
    if (productId) {
      window.history.pushState(null, '', nextUrl);
    } else {
      window.history.replaceState(null, '', nextUrl);
    }
    setSelectedProductId(productId);
  }

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const creatorShareHref =
    selectedProduct && validProductId(selectedProduct.id)
      ? creatorStoreHref(selectedProduct.creator.username, selectedProduct.id)
      : null;

  return (
    <>
      {mode === 'marketplace' && (
        <>
          <div className="marketplaceControls">
            <label htmlFor="marketplace-search">Search creations</label>
            <input
              id="marketplace-search"
              type="search"
              disabled
              placeholder="Search will be available when published listings are connected"
            />
            <nav className="marketplaceCategories" aria-label="Marketplace categories">
              {['Discover', 'Games', 'Visuals', 'Tools', 'New', 'Popular', 'Free', 'Following'].map(
                (category, index) => (
                  <span
                    aria-disabled="true"
                    className={index === 0 ? 'marketplaceCategory selected' : 'marketplaceCategory'}
                    key={category}
                  >
                    {category}
                  </span>
                ),
              )}
            </nav>
          </div>
        </>
      )}

      {products.length > 0 ? (
        <div className="storeProductGrid">
          {products.map((product) => (
            <article className="storeProductCard" key={product.id}>
              <button
                className="storeProductOpen"
                type="button"
                onClick={() => setProductInUrl(product.id, product.creator.username)}
                aria-label={`View ${product.title}`}
              >
                <span className="storeProductPreview">
                  {product.thumbnails[0] && safeThumbnail(product.thumbnails[0]) ? (
                    <img src={safeThumbnail(product.thumbnails[0]) ?? ''} alt="" />
                  ) : (
                    <span aria-hidden="true">SCAMTASTIC / CREATION</span>
                  )}
                </span>
                <span className="storeProductCardBody">
                  <span className="storeProductMeta">
                    <span>{categoryLabel(product.category)}</span>
                    <span>{product.priceBits === 0 ? 'Free' : `${product.priceBits} Bits`}</span>
                  </span>
                  <strong>{product.title}</strong>
                  <span>{product.description}</span>
                </span>
              </button>
              <Link
                className="storeProductCreator"
                href={profileHref(product.creator.username)}
              >
                {product.creator.displayName || `@${product.creator.username}`}
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className="storeEmptyState" aria-live="polite">
          <div className="storeEmptyMark" aria-hidden="true">S</div>
          <div className="tag">// NO PUBLISHED CREATIONS</div>
          <h2>{mode === 'profile' ? 'This store is ready for its first release.' : 'The marketplace is waiting for its first release.'}</h2>
          <p>
            Published creations will appear here when Scamtastic’s publishing system is available.
            No products or prices are listed until creators can publish real items.
          </p>
          <span className="storeBitsNote">Bits purchases are not available.</span>
        </section>
      )}

      <dialog
        className="productDetailDialog"
        ref={dialogRef}
        aria-labelledby="product-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          setProductInUrl(null);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) setProductInUrl(null);
        }}
      >
        <div className="productDialogContent">
          <button
            className="productDialogClose"
            ref={closeButtonRef}
            type="button"
            onClick={() => setProductInUrl(null)}
            aria-label="Close product details"
          >
            Close
          </button>
          {selectedProduct ? (
            <>
              <div className="tag">// CREATION DETAILS</div>
              <h2 id="product-dialog-title">{selectedProduct.title}</h2>
              <p className="productDialogCreator">
                Created by{' '}
                <Link href={profileHref(selectedProduct.creator.username)}>
                  {selectedProduct.creator.displayName || `@${selectedProduct.creator.username}`}
                </Link>
              </p>
              <p>{selectedProduct.description}</p>
              <dl className="productDetailFacts">
                <div><dt>Category</dt><dd>{categoryLabel(selectedProduct.category)}</dd></div>
                <div><dt>Price</dt><dd>{selectedProduct.priceBits === 0 ? 'Free' : `${selectedProduct.priceBits} Bits`}</dd></div>
                <div><dt>Version</dt><dd>{selectedProduct.version || 'Not provided'}</dd></div>
                <div>
                  <dt>Updated</dt>
                  <dd>
                    {selectedProduct.updatedAt
                      ? new Date(selectedProduct.updatedAt).toLocaleDateString()
                      : 'Not provided'}
                  </dd>
                </div>
              </dl>
              <div className="productDialogGallery">
                {selectedProduct.thumbnails.map((thumbnail, index) => {
                  const source = safeThumbnail(thumbnail);
                  return source ? <img key={source} src={source} alt={`${selectedProduct.title} preview ${index + 1}`} /> : null;
                })}
              </div>
              <button className="button secondary" type="button" disabled>
                Purchasing unavailable
              </button>
              {creatorShareHref && <Link className="productShareLink" href={creatorShareHref}>Open shareable creator-store link</Link>}
            </>
          ) : (
            <>
              <div className="tag">// CREATION UNAVAILABLE</div>
              <h2 id="product-dialog-title">This creation is not available.</h2>
              <p>
                It may be unpublished, removed, or not yet available in the marketplace.
              </p>
              {mode === 'marketplace' && profileUsername && (
                <Link className="button secondary" href={profileHref(profileUsername)}>
                  View creator profile
                </Link>
              )}
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
