# fitscroll

A TikTok-style mobile app that generates personalized outfit feeds using AI. Users upload a selfie, select their preferred brands and styles, and the app produces "virtual try-on" images via **Gemini** image generation — showing the user wearing curated outfits sourced from **Pinterest**.

## How It Works

1. **Onboarding** — Pick your gender, upload a selfie, enter favorite brands, and choose fashion styles (Streetwear, Minimalist, Y2K, Old Money, etc.).
2. **Generation** — The app searches Pinterest for outfit inspiration using your preferences, then calls Gemini to composite your selfie into each outfit.
3. **Feed** — Scroll through a vertical, full-screen feed of AI-generated outfits. Like, comment, share, view product breakdowns, and request AI try-ons.

## Architecture

```
┌──────────────────────────┐         ┌─────────────────────────┐
│   Expo / React Native    │  HTTP   │  Pinterest Bridge (Py)  │
│   (runs on phone)        │ ──────► │  (runs on server)       │
│                          │         │  pinterest_scraper_      │
│  • Onboarding            │         │  intitial.py             │
│  • Feed (TikTok-style)   │         └─────────────────────────┘
│  • Local JSON storage    │
│  • Gemini API (direct)   │ ──────► Google Gemini API
└──────────────────────────┘
```

| Layer | Tech |
|---|---|
| Mobile app | Expo SDK 54, React Native 0.81, Expo Router, TypeScript |
| UI | react-native-reanimated, react-native-gesture-handler, Ionicons |
| AI generation | Google Gemini 2.5 Flash (image model) |
| Pinterest data | Python bridge server using `pinscrape` |
| Persistence | Local JSON files via `expo-file-system` |

## Project Structure

```
fitscroll/
├── pinterest_scraper_intitial.py   # Python Pinterest bridge server
├── app/                            # Expo project root
│   ├── app.json                    # Expo config
│   ├── package.json
│   ├── tsconfig.json
│   ├── app/                        # Screens (Expo Router)
│   │   ├── _layout.tsx             # Root layout (dark theme, gesture handler)
│   │   ├── index.tsx               # Entry – routes to onboarding or feed
│   │   ├── onboarding.tsx          # Multi-step user profile setup
│   │   ├── generating.tsx          # Progress screen during AI generation
│   │   └── feed.tsx                # Main vertical-scroll feed
│   └── src/
│       ├── config.ts               # Bridge URL, API keys, constants
│       ├── gemini.ts               # Gemini image generation client
│       ├── pinterest.ts            # Pinterest bridge HTTP client
│       ├── storage.ts              # Local JSON persistence (profile, feed, likes)
│       ├── theme.ts                # Black & white design tokens
│       ├── types.ts                # Shared TypeScript types
│       └── components/
│           ├── ActionBar.tsx        # Like / comment / share / try-on buttons
│           ├── CaptionOverlay.tsx   # Caption text overlay on posts
│           ├── CommentsSheet.tsx    # Bottom sheet for comments
│           ├── ProductSheet.tsx     # Bottom sheet for product details
│           └── SlideshowCard.tsx    # Swipeable image slideshow per post
```

## Prerequisites

- **Node.js** ≥ 18
- **Expo CLI** (`npx expo`)
- **Python** ≥ 3.9 (for the Pinterest bridge)
- **pinscrape** Python package (`pip install pinscrape`)
- A **Google Gemini API key** (set in `app/src/config.ts`)

## Getting Started

### 1. Pinterest Bridge Server

The bridge scrapes Pinterest and serves images to the mobile app. It **must** run on a machine with Python — not on the phone.

```bash
# Install Python dependencies
pip install pinscrape

# Start the bridge server (default port 8000)
python pinterest_scraper_intitial.py serve
```

For remote deployment, set `BRIDGE_URL` in [app/src/config.ts](app/src/config.ts) to your server's address.

### 2. Mobile App

```bash
cd app

# Install JS dependencies
npm install

# Start the Expo dev server
npx expo start
```

Then press **i** for iOS Simulator, **a** for Android emulator, or scan the QR code with Expo Go.

### 3. Configuration

Edit [app/src/config.ts](app/src/config.ts):

| Variable | Description |
|---|---|
| `BRIDGE_URL` | URL of the Pinterest bridge server |
| `PINTEREST_FETCH_LIMIT` | Number of Pinterest images to fetch per generation |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-2.5-flash-image`) |

## Bridge API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/search` | Search Pinterest for outfit images |
| `GET` | `/health` | Health check |
| `GET` | `/images/<filename>` | Serve downloaded Pinterest images |

## Key Features

- **AI Virtual Try-On** — Gemini composites the user's selfie into Pinterest outfit references
- **TikTok-style Feed** — Full-screen vertical scroll with snap-to-page
- **Slideshow Posts** — Swipe through multiple images per outfit
- **Action Bar** — Like (with haptic feedback), comment, share, view products, AI try-on
- **Comments & Likes** — Persisted locally via JSON files
- **Product Breakdown** — Each post lists tagged clothing items with brand and price
- **Dark-Mode UI** — Minimal black & white design system
- **Feed Refresh** — Regenerate the entire feed with fresh Pinterest + Gemini results

## License

Private project.
