from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/toolbar-icons/_source/master.png"
OUTPUT_ROOT = ROOT / "public/assets/toolbar-icons"
ICON_SIZE = 96
CONTENT_SIZE = 76
THEME_COLORS = {
    "light": (24, 49, 83, 255),
    "dark": (242, 246, 251, 255),
}

# Master sheet cell order is documented in the image-generation prompt.
CELL_BY_KEY = {
    "select": 0,
    "navigate": 0,
    "move": 1,
    "move-off": 1,
    "move-planar": 1,
    "rotate": 2,
    "reset": 2,
    "redo": 2,
    "undo": 2,
    "transparency": 3,
    "duplicate": 3,
    "isolate": 4,
    "area-select": 4,
    "details": 4,
    "viewer": 4,
    "hide-surroundings": 5,
    "shadow": 6,
    "high-detail": 7,
    "objects": 7,
    "equipment": 7,
    "floor-spacing": 8,
    "floor-select": 9,
    "save": 9,
    "path-edit": 10,
    "import": 10,
    "play": 11,
    "pause": 12,
    "stop": 13,
    "delete": 13,
    "ground-visible": 14,
    "ground-translucent": 14,
    "ground-section": 14,
    "ground-hidden": 14,
    "terrain": 14,
    "snap": 14,
    "layout-2d": 14,
    "view-3d": 14,
    "world": 14,
    "more": 15,
    "object-list": 15,
    "settings": 15,
    "lock": 7,
    "unlock": 7,
}


def crop_cell(master: Image.Image, index: int) -> Image.Image:
    row, column = divmod(index, 4)
    left = round(column * master.width / 4)
    top = round(row * master.height / 4)
    right = round((column + 1) * master.width / 4)
    bottom = round((row + 1) * master.height / 4)
    return master.crop((left, top, right, bottom))


def normalized_mask(cell: Image.Image) -> Image.Image:
    alpha = cell.getchannel("A")
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError("Icon cell has no visible pixels")
    alpha = alpha.crop(bounds)
    alpha.thumbnail((CONTENT_SIZE, CONTENT_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("L", (ICON_SIZE, ICON_SIZE), 0)
    canvas.paste(alpha, ((ICON_SIZE - alpha.width) // 2, (ICON_SIZE - alpha.height) // 2))
    return canvas


def custom_mask(key: str) -> Image.Image | None:
    """Draw secondary toolbar glyphs that do not exist in the generated master sheet."""
    if key not in {
        "area-select", "delete", "details", "equipment", "import", "layout-2d",
        "lock", "navigate", "object-list", "objects", "save", "settings", "snap",
        "terrain", "unlock", "view-3d", "viewer", "world",
    }:
        return None

    mask = Image.new("L", (ICON_SIZE, ICON_SIZE), 0)
    draw = ImageDraw.Draw(mask)
    stroke = 7

    if key == "navigate":
        draw.polygon(((48, 13), (68, 76), (49, 64), (28, 77)), fill=255)
        draw.polygon(((48, 30), (48, 57), (38, 63)), fill=0)
    elif key == "area-select":
        for points in (
            ((17, 35), (17, 17), (35, 17)), ((61, 17), (79, 17), (79, 35)),
            ((17, 61), (17, 79), (35, 79)), ((61, 79), (79, 79), (79, 61)),
        ):
            draw.line(points, fill=255, width=stroke, joint="curve")
        draw.rectangle((36, 36, 60, 60), outline=255, width=stroke)
    elif key == "object-list":
        for y in (25, 48, 71):
            draw.rounded_rectangle((16, y - 4, 24, y + 4), radius=3, fill=255)
            draw.line((34, y, 80, y), fill=255, width=stroke)
    elif key in {"settings", "details"}:
        xs = (29, 61, 42) if key == "settings" else (61, 35, 57)
        for y, x in zip((25, 48, 71), xs):
            draw.line((16, y, 80, y), fill=255, width=stroke)
            draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=0, outline=255, width=5)
    elif key == "snap":
        draw.arc((19, 15, 77, 76), start=0, end=180, fill=255, width=stroke)
        draw.line((19, 46, 19, 70, 33, 70), fill=255, width=stroke, joint="curve")
        draw.line((77, 46, 77, 70, 63, 70), fill=255, width=stroke, joint="curve")
    elif key == "terrain":
        draw.line((14, 71, 32, 48, 45, 59, 61, 30, 82, 71), fill=255, width=stroke, joint="curve")
        draw.line((17, 79, 79, 79), fill=255, width=stroke)
    elif key == "delete":
        draw.line((26, 26, 70, 26), fill=255, width=stroke)
        draw.line((38, 17, 58, 17), fill=255, width=stroke)
        draw.rounded_rectangle((31, 32, 65, 79), radius=4, outline=255, width=stroke)
        draw.line((43, 43, 43, 67), fill=255, width=5)
        draw.line((54, 43, 54, 67), fill=255, width=5)
    elif key == "import":
        draw.line((48, 15, 48, 61), fill=255, width=stroke)
        draw.line((31, 45, 48, 62, 65, 45), fill=255, width=stroke, joint="curve")
        draw.line((20, 78, 76, 78), fill=255, width=stroke)
    elif key == "save":
        draw.rounded_rectangle((18, 15, 78, 81), radius=5, outline=255, width=stroke)
        draw.rectangle((30, 15, 65, 39), outline=255, width=stroke)
        draw.rounded_rectangle((31, 54, 66, 80), radius=3, outline=255, width=stroke)
    elif key == "world":
        draw.ellipse((16, 16, 80, 80), outline=255, width=stroke)
        draw.arc((32, 16, 64, 80), start=90, end=270, fill=255, width=5)
        draw.arc((32, 16, 64, 80), start=270, end=90, fill=255, width=5)
        draw.line((18, 48, 78, 48), fill=255, width=5)
    elif key == "viewer":
        draw.line((13, 49, 27, 34, 48, 27, 69, 34, 83, 49, 69, 64, 48, 71, 27, 64, 13, 49), fill=255, width=stroke, joint="curve")
        draw.ellipse((38, 39, 58, 59), outline=255, width=6)
    elif key == "layout-2d":
        draw.rounded_rectangle((16, 16, 80, 80), radius=4, outline=255, width=stroke)
        draw.line((48, 19, 48, 77), fill=255, width=5)
        draw.line((19, 48, 77, 48), fill=255, width=5)
    elif key in {"objects", "equipment"}:
        if key == "objects":
            for box in ((17, 17, 43, 43), (53, 17, 79, 43), (17, 53, 43, 79), (53, 53, 79, 79)):
                draw.rounded_rectangle(box, radius=4, outline=255, width=6)
        else:
            draw.rounded_rectangle((15, 22, 81, 75), radius=5, outline=255, width=stroke)
            draw.ellipse((30, 32, 58, 60), outline=255, width=6)
            draw.line((44, 35, 44, 57), fill=255, width=5)
            draw.line((33, 46, 55, 46), fill=255, width=5)
            draw.line((66, 34, 73, 34), fill=255, width=5)
    elif key == "view-3d":
        draw.line((48, 14, 79, 32, 79, 67, 48, 83, 17, 67, 17, 32, 48, 14), fill=255, width=stroke, joint="curve")
        draw.line((17, 32, 48, 50, 79, 32), fill=255, width=5, joint="curve")
        draw.line((48, 50, 48, 82), fill=255, width=5)
    elif key in {"lock", "unlock"}:
        draw.rounded_rectangle((24, 43, 72, 80), radius=5, outline=255, width=stroke)
        if key == "lock":
            draw.arc((31, 14, 65, 57), start=180, end=360, fill=255, width=stroke)
        else:
            draw.arc((43, 14, 77, 57), start=180, end=315, fill=255, width=stroke)
        draw.ellipse((44, 56, 52, 64), fill=255)
        draw.line((48, 63, 48, 70), fill=255, width=5)

    return mask


def apply_variant(mask: Image.Image, key: str) -> Image.Image:
    result = mask.copy()
    if key == "undo":
        result = ImageOps.mirror(result)
    if key in {"move-off", "ground-hidden"}:
        draw = ImageDraw.Draw(result)
        draw.line((18, 18, 78, 78), fill=255, width=7)
    if key == "ground-section":
        draw = ImageDraw.Draw(result)
        draw.line((16, 48, 80, 48), fill=255, width=6)
    if key == "ground-translucent":
        draw = ImageDraw.Draw(result)
        for x in range(22, 78, 14):
            draw.ellipse((x, 76, x + 5, 81), fill=255)
    return result


def colorize(mask: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), color)
    image.putalpha(mask)
    return image


def main() -> None:
    master = Image.open(SOURCE).convert("RGBA")
    masks = {index: normalized_mask(crop_cell(master, index)) for index in set(CELL_BY_KEY.values())}
    for theme, color in THEME_COLORS.items():
        output = OUTPUT_ROOT / theme
        output.mkdir(parents=True, exist_ok=True)
        for key, index in CELL_BY_KEY.items():
            base_mask = custom_mask(key) or masks[index]
            image = colorize(apply_variant(base_mask, key), color)
            image.save(output / f"{key}.png", optimize=True)
    fallback = colorize(masks[15], THEME_COLORS["light"])
    fallback.save(OUTPUT_ROOT / "light/fallback.png", optimize=True)
    fallback = colorize(masks[15], THEME_COLORS["dark"])
    fallback.save(OUTPUT_ROOT / "dark/fallback.png", optimize=True)


if __name__ == "__main__":
    main()
