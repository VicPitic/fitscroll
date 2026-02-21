/**
 * fitscroll – lightweight local JSON persistence
 * Uses expo-file-system SDK 54+ (File / Directory / Paths API)
 */

import { File, Directory, Paths } from 'expo-file-system';
import { OutfitPost, UserProfile } from './types';

const DIR = new Directory(Paths.document, 'fitscroll');
const PROFILE_FILE = new File(DIR, 'profile.json');
const FEED_FILE = new File(DIR, 'feed.json');
const LIKES_FILE = new File(DIR, 'likes.json');
const COMMENTS_FILE = new File(DIR, 'comments.json');

/* ── helpers ── */

function ensureDir() {
  if (!DIR.exists) DIR.create();
}

function readJSON<T>(file: File, fallback: T): T {
  try {
    if (!file.exists) return fallback;
    const raw = file.textSync();
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: File, data: unknown) {
  ensureDir();
  file.write(JSON.stringify(data, null, 2));
}

/* ── profile ── */

const DEFAULT_PROFILE: UserProfile = {
  photoUri: null,
  gender: null,
  keywords: [],
  brands: [],
  styles: [],
  onboarded: false,
};

export async function getProfile(): Promise<UserProfile> {
  return readJSON(PROFILE_FILE, DEFAULT_PROFILE);
}

export async function saveProfile(p: UserProfile) {
  writeJSON(PROFILE_FILE, p);
}

/* ── feed cache ── */

export async function getCachedFeed(): Promise<OutfitPost[]> {
  return readJSON(FEED_FILE, []);
}

export async function cacheFeed(posts: OutfitPost[]) {
  writeJSON(FEED_FILE, posts);
}

/* ── likes ── */

export async function getLikes(): Promise<Record<string, boolean>> {
  return readJSON(LIKES_FILE, {});
}

export async function toggleLike(postId: string): Promise<boolean> {
  const likes = await getLikes();
  likes[postId] = !likes[postId];
  writeJSON(LIKES_FILE, likes);
  return likes[postId];
}

/* ── comments ── */

export async function getComments(postId: string): Promise<{ id: string; text: string; author: string; createdAt: string }[]> {
  const all = readJSON<Record<string, any[]>>(COMMENTS_FILE, {});
  return all[postId] ?? [];
}

export async function addComment(postId: string, text: string) {
  const all = readJSON<Record<string, any[]>>(COMMENTS_FILE, {});
  if (!all[postId]) all[postId] = [];
  all[postId].push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    author: 'you',
    createdAt: new Date().toISOString(),
  });
  writeJSON(COMMENTS_FILE, all);
  return all[postId];
}
