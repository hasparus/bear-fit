# -*- coding: utf-8 -*-
import fontforge, psMat, os

f = fontforge.open("public/fonts/ChicagoFLF.woff")

# --- make a capital-sized acute by extracting it from Oacute ---
def extract_top(srcname, newname, ymin_keep):
    f.selection.none()
    g = f.createChar(-1, newname)
    g.clear()
    src = f[srcname]
    src.foreground  # ensure loaded
    import fontforge as ff
    pen = g.glyphPen()
    # copy contours whose max-y is above threshold (the accent), drop the base letter
    layer = src.foreground.dup()
    keep = fontforge.layer()
    keep.is_quadratic = layer.is_quadratic
    for c in layer:
        if max(p.y for p in c) > ymin_keep:
            keep += c
    g.foreground = keep
    g.width = src.width
    return g
extract_top("Oacute", "acute.cap", 760)   # cap acute: y 785-877, center ~376

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
def lc_acute(cp, base, bc, w):
    make(cp, base, "acute", (bc+46.5)-NAT_ACUTE_C, 0, w)
lc_acute(0x0107,"c",294.5,588)   # ć
lc_acute(0x0144,"n",333.5,667)   # ń
lc_acute(0x015B,"s",291.0,581)   # ś
lc_acute(0x017A,"z",337.5,675)   # ź

# uppercase acute: target center = cap_center + 42.5 (lean from Oacute)
def uc_acute(cp, base, bc, w):
    make(cp, base, "acute.cap", (bc+42.5)-CAP_ACUTE_C, 0, w)
uc_acute(0x0106,"C",348.5,667)   # Ć
uc_acute(0x0143,"N",375.5,750)   # Ń
uc_acute(0x015A,"S",291.5,581)   # Ś
uc_acute(0x0179,"Z",337.5,675)   # Ź

# dotaccent: ż lowercase, Ż raised to cap height (bottom ~785 like cap acute)
make(0x017C,"z","dotaccent",337.5-DOT_C,-51,675)   # ż  dot at acute height (bottom~633)
make(0x017B,"Z","dotaccent",337.5-DOT_C,67,675)    # Ż  dot at cap-acute height (bottom~751)

# ogonek (bottom-right), targets to verify visually
make(0x0105,"a","ogonek",440-OGO_C,0,667)  # ą
make(0x0119,"e","ogonek",420-OGO_C,0,665)  # ę
make(0x0104,"A","ogonek",450-OGO_C,0,667)  # Ą
make(0x0118,"E","ogonek",380-OGO_C,0,583)  # Ę

f.selection.all(); f.unlinkReferences(); f.round()
# remove helper from final cmap (it's unencoded already)
os.makedirs("/tmp/fontpatch/out", exist_ok=True)
for ext in ("ttf","woff","woff2"):
    f.generate("/tmp/fontpatch/out/ChicagoFLF.%s" % ext)
f.close(); print("DONE")
