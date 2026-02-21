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
export const BRIDGE_URL = 'http://172.20.10.2:8000';

/** How many Pinterest inspiration images to fetch per generation */
export const PINTEREST_FETCH_LIMIT = 10;

/** Gemini API key */
export const GEMINI_API_KEY = 'AIzaSyDICyML1zHiB1TJpVr5lFo1t58vJuIJfLU';

/** Gemini model for image generation */
export const GEMINI_MODEL = 'gemini-2.5-flash-image';
