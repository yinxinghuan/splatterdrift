#!/usr/bin/env python3
"""Generate the official SPLATTERDRIFT poster through the Aigram transit API."""

import json
import ssl
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "poster.png"
SOURCE = ROOT / "_production" / "poster-source.webp"
RECORD = ROOT / "_production" / "poster-source.json"
ENDPOINT = "https://chat.aiwaves.tech/aigram/api/gen-image"

REF_URL = "https://cdn.aiwaves.tech/prod/telegram/avatar/0/1785313986924247.webp"

PROMPT = """
Edit this square SPLATTERDRIFT key art. Preserve the exact title spelling,
the strong asteroid impact, the central ring spacecraft, the twin cyan blast,
the warm-white rock fragments, and the immediate recoil conflict.

Replace the entire purple road, rainbow stripe, track markings, lower “60”,
barcode-like marks, and all scenery beneath the craft with deep graphite-black
open space containing only restrained fine ivory dust and a subtle curved cyan
particle recoil wake. Remove the coral warning-sign icon and coral coral-like
plant. Remove the registered trademark symbol after the title. Remove every
number, symbol, icon, logo, watermark, and all text except the single exact
title “SPLATTERDRIFT”.

Make the result sophisticated editorial science fiction: graphite near-black,
warm-white mineral forms, restrained cyan energy, a tiny amount of muted coral
only on the craft, tactile fine particles, subtle film grain. Absolutely no
purple-blue cyberpunk gradient, rainbow, neon road, game UI, score, timer,
warning sign, glossy mobile-game look, or extra decoration.

Keep the exact title large and perfectly legible in the top 20 percent. Keep
the craft, asteroid impact, and twin-shot conflict inside the central 60
percent so they remain unmistakable at 160x160. Reconstruct the bottom 20
percent as quiet dark open space and nonessential dust only. Full bleed to all
four edges; no frame, device, interface, button, HUD, or border.
""".strip()

HEADERS = {
    "Content-Type": "application/json",
    "Origin": "https://aigram.app",
    "Referer": "https://aigram.app/",
    "User-Agent": "Mozilla/5.0",
}
SSL_CONTEXT = ssl._create_unverified_context()


def generate() -> tuple[str, dict]:
    payload = json.dumps({"prompt": PROMPT, "ref_url": REF_URL}).encode()
    last_error = None
    for attempt, delay in enumerate((3, 8, 15), start=1):
        try:
            request = urllib.request.Request(
                ENDPOINT, data=payload, method="POST", headers=HEADERS
            )
            with urllib.request.urlopen(
                request, timeout=420, context=SSL_CONTEXT
            ) as response:
                body = json.loads(response.read())
            url = body.get("url")
            if not url:
                raise RuntimeError(f"missing url: {body}")
            return url, body
        except Exception as error:
            last_error = error
            if attempt < 3:
                time.sleep(delay)
    raise RuntimeError(str(last_error))


def download(url: str) -> None:
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=90, context=SSL_CONTEXT) as response:
        SOURCE.write_bytes(response.read())
    subprocess.run(
        ["sips", "-s", "format", "png", str(SOURCE), "--out", str(OUTPUT)],
        check=True,
        capture_output=True,
    )


def main() -> None:
    url, response = generate()
    download(url)
    RECORD.write_text(
        json.dumps(
            {
                "endpoint": ENDPOINT,
                "origin": "https://aigram.app",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "generated_url": url,
                "prompt": PROMPT,
                "ref_url": REF_URL,
                "response": response,
                "output": "public/poster.png",
                "source": "_production/poster-source.webp",
                "notes": (
                    "Aigram transit raster generation; no ComfyUI, SVG, Canvas, "
                    "or gameplay screenshot."
                ),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"url": url, "output": str(OUTPUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
