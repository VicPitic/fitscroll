/* ── fitscroll shared types ── */

export interface Product {
  id: string;
  name: string;
  brand: string;
  priceLabel: string;
  url?: string;
}

export interface OutfitPost {
  id: string;
  images: string[];          // array of image URIs (slideshow)
  captionHint: string;
  products: Product[];
  liked: boolean;
  likeCount: number;
  commentCount: number;
  comments: Comment[];
  createdAt: string;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export type Gender = 'male' | 'female' | 'non-binary';

export interface UserProfile {
  photoUri: string | null;
  gender: Gender | null;
  keywords: string[];
  brands: string[];
  styles: string[];
  onboarded: boolean;
}

export interface FeedState {
  posts: OutfitPost[];
  cursor: number;
  loading: boolean;
}
