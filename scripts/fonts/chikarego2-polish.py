# -*- coding: utf-8 -*-
# Patches the CC-BY ChiKareGo2 font (Giles Booth) with Polish diacritics and
# renames it to "CziKareDawaj3". ChiKareGo2 is a strict 64-unit pixel grid; the
# acute is a small staircase, and ogonek/dot/l-stroke are drawn as pixels.
# Run from the repo root:
#   fontforge -lang=py -script scripts/fonts/chikarego2-polish.py
import fontforge, psMat, os

PX = 64
f = fontforge.open("scripts/fonts/ChiKareGo2-original.woff")

def px(g, col, row, w=1, h=1):
    """Draw a filled w*h pixel block with bottom-left at (col,row) in pixels."""
    x, y, W, H = col*PX, row*PX, w*PX, h*PX
    p = g.glyphPen(replace=False)
    p.moveTo((x, y)); p.lineTo((x+W, y)); p.lineTo((x+W, y+H)); p.lineTo((x, y+H))
    p.closePath(); p = None

def newglyph(cp, base=None, width=None):
    g = f.createChar(cp)
    g.clear()
    if base:
        g.addReference(base)
        if width is None:
            width = f[base].width
    if width is not None:
        g.width = width
    return g

# pixel rows: x-height top = 7px (448), cap top = 9px (576), baseline = 0
def acute_lc(g, leftcol):              # 3px staircase, bottom row 8 (y512)
    px(g, leftcol, 8); px(g, leftcol+1, 9); px(g, leftcol+2, 10)
def acute_uc(g, leftcol):              # 2px staircase, bottom row 10 (y640) — matches native Ó
    px(g, leftcol, 10); px(g, leftcol+1, 11)
def acute_lc_short(g, leftcol):        # 2px staircase (shorter), bottom row 8
    px(g, leftcol, 8); px(g, leftcol+1, 9)

# --- lowercase acute: 2px, leftcol picked to center on each letter's ink box ---
# (measured: 6px-wide n/z/o center at col2; 5px-wide c/s center best at col1)
for cp, base, lc in [(0x0107,"c",1),(0x0144,"n",2),(0x015B,"s",1),(0x017A,"z",2),(0x00F3,"o",2)]:
    g = newglyph(cp, base); acute_lc_short(g, lc)

# --- uppercase acute (2px, leftcol centered per letter; S is 5px -> col1) ---
for cp, base, lc in [(0x0106,"C",2),(0x0143,"N",3),(0x015A,"S",1),(0x0179,"Z",2)]:
    g = newglyph(cp, base); acute_uc(g, lc)

# --- dot above (ż / Ż): 1px block, moved one pixel left (col2), 1px gap above ---
gz = newglyph(0x017C, "z"); px(gz, 2, 8)          # over z (cols 0-5), col2, row8
gZ = newglyph(0x017B, "Z"); px(gZ, 2, 10)         # over Z, row10 (above cap)

# --- ogonek below-right (ą ę Ą Ę): small 2px hook hanging under the right side ---
def ogonek(g, col):
    px(g, col, -1); px(g, col-1, -2)              # diagonal tail going down-left
ogonek(newglyph(0x0105,"a"), 4)   # ą
ogonek(newglyph(0x0119,"e"), 4)   # ę
ogonek(newglyph(0x0104,"A"), 4)   # Ą
ogonek(newglyph(0x0118,"E"), 4)   # Ę

# --- ł / Ł: diagonal stroke across the stem (stem is cols 0-1) ---
def lstroke(g):
    px(g, -1, 3); px(g, -1, 4); px(g, 2, 4); px(g, 2, 5)   # 2px each side, stepped => clearer slash
g_l = newglyph(0x0142, "l"); lstroke(g_l)
g_L = newglyph(0x0141, "L"); lstroke(g_L)

# flatten references to outlines, weld overlapping pixels, snap to grid
f.selection.all()
f.unlinkReferences()
f.removeOverlap()
f.round()

# rename: now it speaks Polish (ChiKareGo -> CziKareChodź, "go" -> "chodź"/come)
NAME = "CziKareChodz3"
f.familyname = NAME
f.fontname   = NAME
f.fullname   = NAME
for key in ("Family", "Fullname", "PostScriptName", "Preferred Family"):
    f.appendSFNTName("English (US)", key, NAME)
# CC-BY: attribution must be preserved
f.copyright = ("%s: ChiKareGo2 by Giles Booth (CC BY), "
               "extended with Polish diacritics." % NAME)
f.appendSFNTName("English (US)", "License",
                 "Creative Commons Attribution (CC BY). Original: ChiKareGo2 by Giles Booth.")
f.appendSFNTName("English (US)", "License URL",
                 "https://creativecommons.org/licenses/by/4.0/")

for ext in ("woff", "woff2"):
    f.generate("public/fonts/CziKareChodz3.%s" % ext)
os.makedirs("/tmp/fontpatch/out", exist_ok=True)
f.generate("/tmp/fontpatch/out/CziKareChodz3.ttf")   # for previews
f.close(); print("DONE")
