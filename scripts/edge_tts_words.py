#!/usr/bin/env python3
"""
Bridge used by src/tts/impl/edgeTts.ts.

Synthesises `--text-file` with the `edge-tts` Python package (pip install
edge-tts), writes MP3 bytes to `--out`, and prints word boundaries as JSON to
stdout:  [{"word": "...", "startMs": 97.6, "endMs": 311.9}, ...]

The Python package tracks Microsoft's token scheme far more closely than the
Node ports, so it is the preferred route; see README "Text-to-speech".
"""
import argparse
import asyncio
import json
import os
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--text-file", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="en-US-AriaNeural")
    ap.add_argument("--rate", default="+0%")
    ap.add_argument("--pitch", default="+0Hz")
    ap.add_argument("--volume", default="+0%")
    ap.add_argument("--proxy", default=os.environ.get("HTTPS_PROXY") or None)
    args = ap.parse_args()

    try:
        import edge_tts  # type: ignore
    except ImportError:
        print("edge_tts python package not installed (pip install edge-tts)", file=sys.stderr)
        return 3

    with open(args.text_file, "r", encoding="utf-8") as fh:
        text = fh.read()

    async def run() -> None:
        kwargs = dict(rate=args.rate, pitch=args.pitch, volume=args.volume)
        if args.proxy:
            kwargs["proxy"] = args.proxy
        try:
            comm = edge_tts.Communicate(text, args.voice, boundary="WordBoundary", **kwargs)
        except TypeError:  # older edge-tts without the boundary kwarg
            comm = edge_tts.Communicate(text, args.voice, **kwargs)
        audio = bytearray()
        words = []
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 10000.0  # 100ns ticks -> ms
                words.append({
                    "word": chunk["text"],
                    "startMs": round(start, 3),
                    "endMs": round(start + chunk["duration"] / 10000.0, 3),
                })
        if not audio:
            raise RuntimeError("edge-tts returned no audio")
        with open(args.out, "wb") as out:
            out.write(bytes(audio))
        sys.stdout.write(json.dumps(words))

    asyncio.run(run())
    return 0


if __name__ == "__main__":
    sys.exit(main())
