# -*- coding: utf-8 -*-
# Patches the public-domain ChicagoFLF font with Polish diacritics and renames
# it to "Czikago". Run from the repo root:
#   fontforge -lang=py -script scripts/fonts/add-polish-glyphs.py
import fontforge, psMat, os

f = fontforge.open("scripts/fonts/ChicagoFLF-original.woff")

# --- reshape acute into a "cut" triangle (comma-like wedge) ---
# original acute was a uniform slanted bar (357,800)(274,800)(133,633)(216,633).
# A plain triangle tapered to a thin point; cut the tip into a short flat foot
# so it reads like the font's comma.
a = f["acute"]
a.clear()
pen = a.glyphPen()
pen.moveTo((357, 800)); pen.lineTo((210, 800))   # wide top edge
pen.lineTo((133, 633)); pen.lineTo((190, 633))    # cut foot (flat, not a point)
pen.closePath()
pen = None
a.correctDirection()

# --- smaller dot for ż/Ż (the native dotaccent was too chunky on caps) ---
dot = f.createChar(-1, "dot.sm")
dot.clear()
pen = dot.glyphPen()                               # 112-square, centered x170, sits on baseline
pen.moveTo((112,0)); pen.lineTo((224,0)); pen.lineTo((224,112)); pen.lineTo((112,112))
pen.closePath()
pen = None
dot.correctDirection()
DOTSM_C = 168.0   # x-center of dot.sm

# encode existing lstroke outlines
for cp,nm in [(0x142,"lslash"),(0x141,"Lslash")]:
    if nm in f: f[nm].unicode = cp

NAT_ACUTE_C = 245.0     # native lowercase acute center
CAP_ACUTE_C = 376.0     # acute.cap center (as positioned in Oacute)
DOT_C = 170.0           # native dotaccent center
OGO_C = 179.0           # native ogonek center

def make(cp, base, accent, dx, dy, width):
    g = f.createChar(cp)
    g.clear()
    g.addReference(base, psMat.translate(0,0))
    g.addReference(accent, psMat.translate(dx,dy))
    g.width = width
    return g

# lowercase acute: target center = base_center + 46.5 (designer lean from oacute)
LC_DY = 30   # small extra gap between accent and letter
def lc_acute(cp, base, bc, w):
    make(cp, base, "acute", (bc+46.5)-NAT_ACUTE_C, LC_DY, w)
lc_acute(0x0107,"c",294.5,588)   # ć
lc_acute(0x0144,"n",333.5,667)   # ń
lc_acute(0x015B,"s",291.0,581)   # ś
lc_acute(0x017A,"z",337.5,675)   # ź

# uppercase acute: use the chunky native acute (not the thin cap one),
# raised above cap height. Also override Ó so all caps match.
CAP_DY = 162     # native acute bottom 633 -> ~795 (a bit more gap above cap top 750)
def uc_acute(cp, base, bc, w):
    make(cp, base, "acute", (bc+46.5)-NAT_ACUTE_C, CAP_DY, w)
uc_acute(0x00D3,"O",333.5,667)   # Ó (override thin original)
uc_acute(0x0106,"C",348.5,667)   # Ć
uc_acute(0x0143,"N",375.5,750)   # Ń
uc_acute(0x015A,"S",291.5,581)   # Ś
uc_acute(0x0179,"Z",337.5,675)   # Ź

# smaller dot for ż/Ż, centered over z, placed just above the letter
make(0x017C,"z","dot.sm",337.5-DOTSM_C,678,675)    # ż  dot at 678-790 (a bit more gap above x-height)
make(0x017B,"Z","dot.sm",337.5-DOTSM_C,802,675)    # Ż  dot at 802-914 (a bit more gap above cap)

# ogonek (bottom-right), targets to verify visually
make(0x0105,"a","ogonek",440-OGO_C,0,667)  # ą
make(0x0119,"e","ogonek",420-OGO_C,0,665)  # ę
make(0x0104,"A","ogonek",450-OGO_C,0,667)  # Ą
make(0x0118,"E","ogonek",380-OGO_C,0,583)  # Ę

f.selection.all(); f.unlinkReferences(); f.round()

# rename: it speaks Polish now
f.familyname = "Czikago"
f.fontname   = "Czikago"
f.fullname   = "Czikago"
for key in ("Family", "Fullname", "PostScriptName", "Preferred Family"):
    f.appendSFNTName("English (US)", key, "Czikago")
# the original file carried a stale "All Rights Reserved" string; replace it with
# the actually-accepted provenance (Casady's ChicagoFLF is released as public domain)
f.copyright = ("Czikago: ChicagoFLF (Robin Casady, public domain), a revival of "
               "Chicago by Susan Kare, extended with Polish diacritics.")
f.appendSFNTName("English (US)", "License",
                 "Public domain, per Robin Casady's ChicagoFLF release.")

for ext in ("woff", "woff2"):
    f.generate("public/fonts/Czikago.%s" % ext)
os.makedirs("/tmp/fontpatch/out", exist_ok=True)
f.generate("/tmp/fontpatch/out/Czikago.ttf")   # for previews only
f.close(); print("DONE")
