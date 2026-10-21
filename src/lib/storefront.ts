export type StoreProductCategory = 'game' | 'visual' | 'tool' | 'software';

export type StoreProduct = {
  id: string;
  title: string;
  description: string;
  category: StoreProductCategory;
  priceBits: number;
  version: string | null;
  updatedAt: string | null;
  thumbnails: string[];
  creator: {
    username: string;
    displayName: string | null;
    avatarSeed: string;
    avatarVersion: number;
  };
};

export const emptyPublishedProducts: StoreProduct[] = [];
