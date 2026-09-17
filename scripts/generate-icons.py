"""
Generate Android PWA launcher, splash, and maskable icons for PIW.
Uses Python Pillow to draw clean, crisp vector-like bitmap icons.
"""
import os
from PIL import Image, ImageDraw, ImageFont

ICONS_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(ICONS_DIR, exist_ok=True)

def create_icon(size: int, is_maskable: bool = False) -> Image.Image:
    # 1. Create image with dark background
    img = Image.new("RGBA", (size, size), (9, 9, 11, 255)) # #09090b
    draw = ImageDraw.Draw(img)

    # 2. Draw subtle border / rounded container if not maskable
    center = size / 2
    
    # Safe area margin: maskable requires content within 80% circle (10% padding on all sides)
    margin = size * (0.22 if is_maskable else 0.12)
    glyph_box = [margin, margin, size - margin, size - margin]

    # Inner badge background
    badge_color = (24, 24, 27, 255) # #18181b
    badge_radius = size * 0.2
    draw.rounded_rectangle(glyph_box, radius=badge_radius, fill=badge_color, outline=(39, 39, 42, 255), width=max(1, int(size * 0.015)))

    # Draw the stylized "P" logo
    # Outer stem and loop coordinates relative to glyph_box
    gx1, gy1, gx2, gy2 = glyph_box
    gw = gx2 - gx1
    gh = gy2 - gy1

    # Stem width
    sw = gw * 0.18
    # Stem: left edge
    stem_x = gx1 + gw * 0.28
    stem_top = gy1 + gh * 0.22
    stem_bottom = gy1 + gh * 0.78
    draw.rounded_rectangle([stem_x, stem_top, stem_x + sw, stem_bottom], radius=sw * 0.4, fill=(250, 250, 250, 255))

    # P loop (outer)
    loop_top = stem_top
    loop_bottom = gy1 + gh * 0.54
    loop_right = gx1 + gw * 0.74
    draw.rounded_rectangle([stem_x, loop_top, loop_right, loop_bottom], radius=(loop_bottom - loop_top) * 0.5, fill=(250, 250, 250, 255))

    # P loop hole (inner cutout)
    hole_inset_x = sw * 0.9
    hole_inset_y = sw * 0.7
    draw.rounded_rectangle(
        [stem_x + sw, loop_top + hole_inset_y, loop_right - hole_inset_x, loop_bottom - hole_inset_y],
        radius=((loop_bottom - loop_top) - 2 * hole_inset_y) * 0.5,
        fill=badge_color
    )

    # Small intelligence accent dot (cyan/violet glow) representing the AI Copilot node
    dot_radius = sw * 0.38
    dot_cx = loop_right - dot_radius
    dot_cy = loop_bottom + gh * 0.14
    # Ambient glow
    draw.ellipse([dot_cx - dot_radius * 1.5, dot_cy - dot_radius * 1.5, dot_cx + dot_radius * 1.5, dot_cy + dot_radius * 1.5], fill=(59, 130, 246, 70))
    # Core dot
    draw.ellipse([dot_cx - dot_radius, dot_cy - dot_radius, dot_cx + dot_radius, dot_cy + dot_radius], fill=(96, 165, 250, 255))

    return img

def main():
    sizes = [
        ("icon-192x192.png", 192, False),
        ("icon-512x512.png", 512, False),
        ("icon-maskable-192x192.png", 192, True),
        ("icon-maskable-512x512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
    ]

    for filename, size, maskable in sizes:
        out_path = os.path.join(ICONS_DIR, filename)
        icon = create_icon(size, is_maskable=maskable)
        icon.save(out_path, "PNG", optimize=True)
        print(f"Generated {filename} ({size}x{size}) -> {out_path}")

    # Also create a crisp SVG version for general usage
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="100" fill="#09090b"/>
  <rect x="61" y="61" width="390" height="390" rx="90" fill="#18181b" stroke="#27272a" stroke-width="6"/>
  <!-- Stem -->
  <rect x="170" y="147" width="70" height="218" rx="20" fill="#fafafa"/>
  <!-- Loop -->
  <path d="M170,147 H290 C340,147 360,180 360,215 C360,250 340,283 290,283 H170 Z" fill="#fafafa"/>
  <!-- Cutout -->
  <path d="M240,195 H285 C308,195 315,205 315,215 C315,225 308,235 285,235 H240 Z" fill="#18181b"/>
  <!-- Intelligence Node -->
  <circle cx="340" cy="340" r="28" fill="#3b82f6" opacity="0.4"/>
  <circle cx="340" cy="340" r="18" fill="#60a5fa"/>
</svg>'''
    with open(os.path.join(ICONS_DIR, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)
    print("Generated icon.svg")

if __name__ == "__main__":
    main()
