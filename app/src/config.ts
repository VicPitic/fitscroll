/**
 * fitscroll – App-wide configuration
 *
 * BRIDGE_URL must point to the hosted Pinterest bridge server
 * (the Python script running `pinterest_scraper_intitial.py serve`).
 *
 * ⚠️  The bridge CANNOT run on the phone – it needs Python + pinscrape.
 *     Deploy it on any server / VPS / cloud run and set the URL here.
 */

// Replace with your hosted bridge URL (e.g. https://fitscroll-bridge.fly.dev)
// For local dev over the same Wi-Fi, use your machine's LAN IP:
// e.g. http://192.168.1.42:8000
// For iOS Simulator, use localhost (it shares the Mac's network stack).
export const BRIDGE_URL = 'http://localhost:8000';

/** How many Pinterest inspiration images to fetch per generation */
export const PINTEREST_FETCH_LIMIT = 10;

/** Gemini API key */
export const GEMINI_API_KEY = 'AIzaSyBGUPLgV_ZpUZuB8QEAo35jNWQpMJQH25M';

/** Gemini model for image generation */
export const GEMINI_MODEL = 'gemini-2.5-flash-image';
