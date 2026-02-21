"""
fitscroll Pinterest bridge

Responsibilities:
1. Scrape Pinterest images from keywords using pinscrape.
2. Download images locally into ./local_db/pinterest_images.
3. Persist searchable JSON manifest in ./local_db/pinterest_manifest.json.
4. Serve HTTP endpoints for the Expo app:
   - POST /search
   - GET /health
   - GET /images/<filename>
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

from pinscrape import Pinterest

ROOT_DIR = Path(__file__).resolve().parent
LOCAL_DB_DIR = ROOT_DIR / "local_db"
IMAGES_DIR = LOCAL_DB_DIR / "pinterest_images"
MANIFEST_PATH = LOCAL_DB_DIR / "pinterest_manifest.json"


@dataclass
class ScrapeConfig:
    keywords: List[str]
    limit_per_keyword: int
    download_images: bool


def ensure_dirs() -> None:
    LOCAL_DB_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)


def parse_keywords(raw: str) -> List[str]:
    return [segment.strip() for segment in raw.split(",") if segment.strip()]


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "keyword"


def build_products(keyword: str, seed: int) -> List[Dict[str, str]]:
    tokens = [token for token in keyword.split(" ") if token]
    anchor = tokens[0].capitalize() if tokens else "Core"
    accent = tokens[1].capitalize() if len(tokens) > 1 else "Classic"
    return [
        {
            "id": f"{slugify(keyword)}-{seed}-1",
            "name": f"{anchor} Jacket",
            "brand": "fitscroll edit",
            "priceLabel": f"${89 + (seed % 6) * 17}",
        },
        {
            "id": f"{slugify(keyword)}-{seed}-2",
            "name": f"{accent} Pants",
            "brand": "fitscroll edit",
            "priceLabel": f"${69 + (seed % 5) * 14}",
        },
    ]


def read_manifest() -> Dict:
    if not MANIFEST_PATH.exists():
        return {"generated_at": None, "outfits": []}

    try:
        text = MANIFEST_PATH.read_text(encoding="utf-8").strip()
        if not text:
            return {"generated_at": None, "outfits": []}
        return json.loads(text)
    except (json.JSONDecodeError, OSError):
        return {"generated_at": None, "outfits": []}


def write_manifest(data: Dict) -> None:
    with MANIFEST_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


def download_image(url: str, keyword: str) -> str | None:
    suffix = Path(urlparse(url).path).suffix.lower()
    extension = suffix if suffix in {".jpg", ".jpeg", ".png", ".webp"} else ".jpg"
    filename = f"{slugify(keyword)}-{uuid.uuid4().hex[:10]}{extension}"
    destination = IMAGES_DIR / filename

    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            )
        },
    )

    try:
        with urlopen(request, timeout=20) as response, destination.open("wb") as file:
            file.write(response.read())
        return str(destination)
    except Exception:
        return None


def scrape_keywords(config: ScrapeConfig) -> Dict:
    ensure_dirs()
    scraper = Pinterest(proxies={}, sleep_time=1)

    manifest = read_manifest()
    outfits = manifest.get("outfits", [])

    for keyword in config.keywords:
        try:
            urls = scraper.search(keyword, config.limit_per_keyword)
        except Exception as exc:
            print(f"[warn] pinscrape failed for '{keyword}': {exc}")
            continue

        for index, raw_url in enumerate(urls):
            url = str(raw_url)  # pinscrape returns HttpUrl objects
            local_path = download_image(url, keyword) if config.download_images else None
            outfits.append(
                {
                    "id": f"{slugify(keyword)}-{uuid.uuid4().hex[:10]}",
                    "keyword": keyword,
                    "image_url": url,
                    "local_path": local_path,
                    "source_url": url,
                    "caption_hint": f"{keyword} fit",
                    "products": build_products(keyword, index),
                }
            )

    deduped = []
    seen_urls = set()
    for outfit in outfits:
        marker = str(outfit.get("local_path") or outfit.get("image_url"))
        if marker in seen_urls:
            continue
        seen_urls.add(marker)
        deduped.append(outfit)

    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "outfits": deduped,
    }
    write_manifest(output)
    return output


def filter_outfits(keywords: List[str], limit: int) -> List[Dict]:
    manifest = read_manifest()
    outfits = manifest.get("outfits", [])

    if not keywords:
        return outfits[:limit]

    normalized = [keyword.lower() for keyword in keywords]
    scored = []

    for outfit in outfits:
        key = outfit.get("keyword", "").lower()
        score = sum(1 for token in normalized if token in key)
        if score:
            scored.append((score, outfit))

    scored.sort(key=lambda entry: entry[0], reverse=True)
    selected = [outfit for _, outfit in scored][:limit]

    if len(selected) < limit:
        existing_ids = {item.get("id") for item in selected}
        for outfit in outfits:
            if outfit.get("id") in existing_ids:
                continue
            selected.append(outfit)
            if len(selected) >= limit:
                break

    return selected


def to_api_outfits(outfits: List[Dict], host: str, port: int) -> List[Dict]:
    response = []

    for outfit in outfits:
        local_path = outfit.get("local_path")
        if local_path and Path(local_path).exists():
            image_url = f"http://{host}:{port}/images/{Path(local_path).name}"
        else:
            image_url = outfit.get("image_url")

        response.append(
            {
                "imageUrl": image_url,
                "sourceUrl": outfit.get("source_url") or outfit.get("image_url"),
                "captionHint": outfit.get("caption_hint") or outfit.get("keyword") or "lookbook",
                "products": outfit.get("products") or [],
            }
        )

    return response


class PinterestBridgeHandler(BaseHTTPRequestHandler):
    server_version = "fitscroll-pinterest-bridge/1.0"

    def _json_response(self, status: int, payload: Dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json_response(200, {"status": "ok", "manifest": str(MANIFEST_PATH)})
            return

        if self.path.startswith("/images/"):
            filename = unquote(self.path.replace("/images/", "", 1))
            target = IMAGES_DIR / filename
            if not target.exists() or not target.is_file():
                self._json_response(404, {"error": "image-not-found"})
                return

            mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            content = target.read_bytes()

            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
            return

        self._json_response(404, {"error": "not-found"})

    def do_POST(self) -> None:
        if self.path != "/search":
            self._json_response(404, {"error": "not-found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else "{}"
            payload = json.loads(raw)
        except Exception:
            self._json_response(400, {"error": "invalid-json"})
            return

        keywords = payload.get("keywords") or []
        if not isinstance(keywords, list):
            self._json_response(400, {"error": "keywords-must-be-array"})
            return

        parsed_keywords = [str(keyword).strip() for keyword in keywords if str(keyword).strip()]
        limit = int(payload.get("limit") or 12)
        limit = max(1, min(limit, 60))
        fresh = bool(payload.get("fresh", False))

        try:
            if fresh:
                # Wipe old manifest so we start clean
                print(f"[bridge] Fresh mode — clearing old manifest")
                write_manifest({"generated_at": None, "outfits": []})

            manifest = read_manifest()
            existing_keywords = {
                o.get("keyword", "").lower() for o in manifest.get("outfits", [])
            }

            # Find keywords that have NO coverage yet in the manifest
            missing_keywords = [
                kw for kw in parsed_keywords
                if kw.lower() not in existing_keywords
            ]

            if missing_keywords:
                print(f"[bridge] Scraping new keywords: {missing_keywords} (limit {limit})")
                scrape_keywords(
                    ScrapeConfig(
                        keywords=missing_keywords,
                        limit_per_keyword=max(4, min(20, limit // max(1, len(missing_keywords)) + 2)),
                        download_images=True,
                    )
                )
            elif len(manifest.get("outfits", [])) < limit and parsed_keywords:
                # All keywords exist but we don't have enough results yet
                print(f"[bridge] Topping up existing keywords (have {len(manifest.get('outfits', []))}, need {limit})")
                scrape_keywords(
                    ScrapeConfig(
                        keywords=parsed_keywords,
                        limit_per_keyword=max(4, min(20, limit // max(1, len(parsed_keywords)) + 2)),
                        download_images=True,
                    )
                )

            selected = filter_outfits(parsed_keywords, limit)
            host_header = self.headers.get("Host", "")
            if ":" in host_header:
                host_name, port_text = host_header.rsplit(":", 1)
                try:
                    port_value = int(port_text)
                except ValueError:
                    _, port_value = self.server.server_address
            else:
                host_name, port_value = self.server.server_address

            print(f"[bridge] Returning {len(selected)} outfits")
            self._json_response(200, {"outfits": to_api_outfits(selected, host_name, port_value)})
        except Exception as exc:
            import traceback
            traceback.print_exc()
            self._json_response(500, {"error": str(exc)})


def serve(host: str, port: int) -> None:
    ensure_dirs()
    server = ThreadingHTTPServer((host, port), PinterestBridgeHandler)
    print(f"[fitscroll] Pinterest bridge listening on http://{host}:{port}")
    server.serve_forever()


def main() -> None:
    parser = argparse.ArgumentParser(description="fitscroll Pinterest scraper bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scrape_parser = subparsers.add_parser("scrape", help="Scrape and write local manifest")
    scrape_parser.add_argument("--keywords", required=True, help="Comma-separated keywords")
    scrape_parser.add_argument("--limit-per-keyword", type=int, default=10)
    scrape_parser.add_argument("--skip-download", action="store_true")

    serve_parser = subparsers.add_parser("serve", help="Run local HTTP bridge")
    serve_parser.add_argument("--host", default="0.0.0.0")
    serve_parser.add_argument("--port", type=int, default=8000)

    args = parser.parse_args()

    if args.command == "scrape":
        keywords = parse_keywords(args.keywords)
        if not keywords:
            raise SystemExit("At least one keyword is required.")

        result = scrape_keywords(
            ScrapeConfig(
                keywords=keywords,
                limit_per_keyword=max(1, args.limit_per_keyword),
                download_images=not args.skip_download,
            )
        )
        print(
            f"[fitscroll] scraped {len(result.get('outfits', []))} outfits -> {MANIFEST_PATH}"
        )
        return

    if args.command == "serve":
        serve(args.host, args.port)
        return


if __name__ == "__main__":
    main()
