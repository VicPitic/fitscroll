/**
 * fitscroll – Gemini image generation service
 *
 * Uses the Gemini image generation model to produce "try-on" images:
 *   user selfie + Pinterest outfit reference → user wearing that outfit.
 *
 * The Gemini API is called directly from the phone (it's a simple HTTPS
 * request with an API key – no server needed for this part).
 */

import { File, Directory, Paths } from 'expo-file-system';
import { GEMINI_API_KEY, GEMINI_MODEL } from './config';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

export function getGeminiKey(): string {
  return GEMINI_API_KEY;
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/* ── helpers ── */

/** Convert a Uint8Array to a base64 string (works in Hermes) */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Simple delay */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Download a remote image and return its base64 + detected mime type */
export async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log('[gemini] Fetching image:', url.slice(0, 100));
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[gemini] fetchImage HTTP error', res.status, url.slice(0, 100));
      return null;
    }
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = await res.arrayBuffer();
    const b64 = uint8ToBase64(new Uint8Array(buf));
    console.log('[gemini] Fetched image OK, size:', b64.length, 'chars base64');
    return {
      base64: b64,
      mimeType: contentType.split(';')[0].trim(),
    };
  } catch (e) {
    console.warn('[gemini] fetchImageAsBase64 error', e);
    return null;
  }
}

/** Read a local file URI as base64 */
export async function readLocalImageAsBase64(
  uri: string,
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    console.log('[gemini] Reading local image:', uri.slice(0, 120));
    const file = new File(uri);
    if (!file.exists) {
      console.warn('[gemini] Local file does not exist:', uri);
      return null;
    }
    const b64 = await file.base64();
    console.log('[gemini] Read local image OK, size:', b64.length, 'chars base64');

    // Guess mime from extension — File.extension returns WITHOUT dot (e.g. "jpg")
    const ext = (file.extension ?? 'jpg').toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/jpeg', // treat HEIC as JPEG for compatibility
    };
    const mimeType = mimeMap[ext] ?? 'image/jpeg';
    return { base64: b64, mimeType };
  } catch (e) {
    console.warn('[gemini] readLocalImage error', e);
    return null;
  }
}

/* ── Generation directory ── */

function getGenDir(): Directory {
  const dir = new Directory(Paths.document, 'fitscroll', 'generated');
  if (!dir.exists) dir.create();
  return dir;
}

/* ── Core generate call ── */

/**
 * Call Gemini with one or more images + a text prompt.
 * Returns the local file URI of the first generated image, or null.
 * Retries on transient failures.
 */
export async function generateWithImages(
  prompt: string,
  images: { base64: string; mimeType: string }[],
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[gemini] No API key configured');
    return null;
  }

  const parts: GeminiPart[] = [{ text: prompt }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
  }

  const url = `${BASE_URL}/${GEMINI_MODEL}:generateContent`;
  console.log('[gemini] Calling API:', GEMINI_MODEL, '| images:', images.length, '| prompt length:', prompt.length);

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        aspectRatio: '9:16',
      },
    },
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[gemini] Retry attempt ${attempt}/${MAX_RETRIES}`);
        await delay(RETRY_DELAY_MS * attempt);
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[gemini] API error ${res.status}:`, errText.slice(0, 500));
        // Retry on 429 (rate limit) or 500+ (server error)
        if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
          continue;
        }
        return null;
      }

      const json = await res.json();
      const candidates = json.candidates ?? [];

      if (candidates.length === 0) {
        console.warn('[gemini] No candidates in response');
        if (json.promptFeedback) {
          console.warn('[gemini] promptFeedback:', JSON.stringify(json.promptFeedback).slice(0, 300));
        }
        return null;
      }

      for (const c of candidates) {
        for (const p of c.content?.parts ?? []) {
          if (p.inlineData?.data) {
            console.log('[gemini] Got generated image! Saving locally…');
            const genDir = getGenDir();
            const filename = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.png`;
            const outFile = new File(genDir, filename);
            // Decode base64 to bytes and write
            const raw = atob(p.inlineData.data);
            const bytes = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
            outFile.write(bytes);
            console.log('[gemini] Saved generated image:', outFile.uri);
            return outFile.uri;
          }
        }
      }

      // No image in response — log the text parts for debugging
      for (const c of candidates) {
        for (const p of c.content?.parts ?? []) {
          if (p.text) console.log('[gemini] text-only response:', p.text.slice(0, 300));
        }
      }

      console.warn('[gemini] Response had candidates but no image data');
      return null;
    } catch (err) {
      console.warn(`[gemini] Network error (attempt ${attempt}):`, err);
      if (attempt < MAX_RETRIES) continue;
      return null;
    }
  }

  return null;
}

/* ── Style-to-environment mapping ── */

const STYLE_ENVIRONMENTS: Record<string, string> = {
  streetwear: 'walking through a gritty downtown area with industrial buildings, chain-link fences, and raw concrete — shot like a hypebeast Instagram post',
  minimalist: 'standing in a clean Scandinavian-style apartment with floor-to-ceiling windows, neutral tones, and soft morning light filtering in',
  athleisure: 'leaving a trendy juice bar or gym entrance on a sunny day, casually holding a coffee — candid street style vibe',
  vintage: 'browsing through a thrift store or flea market with racks of clothes and warm tungsten lighting — effortlessly cool',
  preppy: 'walking across a manicured Ivy League campus with brick buildings and autumn leaves, or lounging at a country club patio',
  y2k: 'posing in a mirror selfie setup with LED strip lights, butterfly clips aesthetic, glossy surfaces, and a pink-tinted room',
  'dark academia': 'sitting in a moody European café or old bookstore with wooden shelves, espresso, and rain on the windows outside',
  cottagecore: 'standing in a golden-hour flower field or a rustic farmhouse garden with a wicker basket — dreamy and soft-focus',
  techwear: 'walking through a wet city underpass at night with harsh overhead fluorescent lights, puddles reflecting neon, and utilitarian architecture',
  'old money': 'stepping out of a luxury car onto a cobblestone European street, or on a yacht deck with the coastline behind — quiet luxury energy',
  casual: 'hanging out at a rooftop bar or a beach-side café with friends, golden hour sunlight, relaxed and effortless',
  'avant-garde': 'posing in front of a brutalist concrete building or an abstract art installation — editorial, dramatic, high-fashion energy',
};

function getEnvironment(style: string): string {
  const key = style.toLowerCase().trim();
  return STYLE_ENVIRONMENTS[key] ?? 'a stylish, photogenic location with beautiful natural lighting';
}

/* ── High-level: generate try-on ── */

/**
 * Generate the user wearing an outfit from a Pinterest reference image.
 *
 * @param userPhotoUri  Local file URI of the user's selfie.
 * @param outfitImageUrl  Remote URL of the outfit inspiration (prefer original Pinterest CDN URL).
 * @param outfitDescription  Text describing the outfit / keyword.
 * @param gender  User's gender for prompt accuracy.
 * @param style  Primary fashion style for environment / scene selection.
 * @returns  Local file URI of the generated image, or null on failure.
 */
export async function generateTryOn(
  userPhotoUri: string,
  outfitImageUrl: string,
  outfitDescription: string,
  gender?: string | null,
  style?: string | null,
): Promise<string | null> {
  console.log('[gemini] ── generateTryOn START ──');
  console.log('[gemini] userPhoto:', userPhotoUri.slice(0, 80));
  console.log('[gemini] outfitUrl:', outfitImageUrl.slice(0, 100));
  console.log('[gemini] description:', outfitDescription);
  console.log('[gemini] gender:', gender, '| style:', style);

  // 1. Load user photo
  const userImg = await readLocalImageAsBase64(userPhotoUri);
  if (!userImg) {
    console.warn('[gemini] ✗ Cannot read user photo — aborting try-on');
    return null;
  }

  // 2. Download outfit reference image
  const outfitImg = await fetchImageAsBase64(outfitImageUrl);
  if (!outfitImg) {
    console.warn('[gemini] ✗ Cannot fetch outfit image — aborting try-on');
    return null;
  }

  // 3. Build environment-aware prompt
  const env = getEnvironment(style ?? outfitDescription);
  const personWord = gender === 'female' ? 'woman' : gender === 'male' ? 'man' : 'person';

  const prompt = [
    `You are a high-end fashion photographer AI. I'm giving you two images:`,
    `IMAGE 1 is a photo of a ${personWord}. IMAGE 2 is an outfit / fashion inspiration.`,
    `Generate a new photorealistic image of the SAME ${personWord} from IMAGE 1`,
    `wearing the outfit shown in IMAGE 2.`,
    `The outfit style is: ${outfitDescription}.`,
    `IMPORTANT: The photo must look like a real fashion photoshoot, NOT a studio photo.`,
    `Set the scene in ${env}.`,
    `The ${personWord} should be posing naturally and confidently in this environment.`,
    `Keep the ${personWord}'s face, skin tone, hair, and body proportions identical to IMAGE 1.`,
    `Full-body shot. Cinematic lighting. Professional fashion editorial quality.`,
    `The photo should feel aspirational and Instagram-worthy.`,
  ].join(' ');

  const result = await generateWithImages(prompt, [userImg, outfitImg]);
  console.log('[gemini] ── generateTryOn END ──', result ? 'SUCCESS' : 'FAILED');
  return result;
}
