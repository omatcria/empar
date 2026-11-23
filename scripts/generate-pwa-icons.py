"""Gera os ícones PWA e os arquivos de marca do Empar a partir da identidade visual.

Uso: python scripts/generate-pwa-icons.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Uploads" / "empar identidade visual"
ICON_SRC = SRC / "02_empar_icone.png"
BLACK_SRC = SRC / "04_empar_black.png"
ICONS = ROOT / "public" / "icons"
BRAND = ROOT / "public" / "brand"


def crop_symbol(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    return img.crop(bbox)


def square_icon(symbol: Image.Image, size: int, ratio: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    target = int(size * ratio)
    scale = target / max(symbol.size)
    w, h = max(1, round(symbol.width * scale)), max(1, round(symbol.height * scale))
    resized = symbol.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - w) // 2, (size - h) // 2))
    return canvas.convert("RGB")


def badge_icon(symbol: Image.Image, size: int = 72, ratio: float = 0.8) -> Image.Image:
    """Silhueta branca do símbolo em fundo transparente (badge de notificação)."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target = int(size * ratio)
    scale = target / max(symbol.size)
    w, h = max(1, round(symbol.width * scale)), max(1, round(symbol.height * scale))
    alpha = symbol.getchannel("A").resize((w, h), Image.LANCZOS)
    white = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    white.putalpha(alpha)
    canvas.alpha_composite(white, ((size - w) // 2, (size - h) // 2))
    return canvas


def split_wordmark(img: Image.Image) -> Image.Image:
    """Separa símbolo e palavra pela maior sequência de colunas vazias do alfa."""
    alpha = img.getchannel("A")
    w, h = img.size
    px = alpha.load()
    empty = [all(px[x, y] == 0 for y in range(h)) for x in range(w)]
    xs = [x for x in range(w) if not empty[x]]
    first, last = xs[0], xs[-1]
    best_len, best_start, run_start = 0, first, None
    for x in range(first, last + 1):
        if empty[x]:
            if run_start is None:
                run_start = x
        elif run_start is not None:
            if x - run_start > best_len:
                best_len, best_start = x - run_start, run_start
            run_start = None
    word = img.crop((best_start + best_len, 0, last + 1, h))
    word = word.crop(word.getchannel("A").getbbox())
    new_w = round(word.width * 96 / word.height)
    return word.resize((new_w, 96), Image.LANCZOS)


def main() -> None:
    ICONS.mkdir(parents=True, exist_ok=True)
    BRAND.mkdir(parents=True, exist_ok=True)
    symbol = crop_symbol(Image.open(ICON_SRC).convert("RGBA"))

    square_icon(symbol, 192, 0.8).save(ICONS / "icon-192.png")
    square_icon(symbol, 512, 0.8).save(ICONS / "icon-512.png")
    square_icon(symbol, 512, 0.6).save(ICONS / "maskable-512.png")
    square_icon(symbol, 180, 0.8).save(ICONS / "apple-touch-icon-180.png")
    square_icon(symbol, 32, 0.8).save(ICONS / "favicon-32.png")
    badge_icon(symbol).save(ICONS / "badge-72.png")

    scale = 256 / max(symbol.size)
    symbol.resize(
        (max(1, round(symbol.width * scale)), max(1, round(symbol.height * scale))),
        Image.LANCZOS,
    ).save(BRAND / "empar-symbol.png")

    split_wordmark(Image.open(BLACK_SRC).convert("RGBA")).save(BRAND / "empar-wordmark.png")
    print("ok")


if __name__ == "__main__":
    main()
