# -*- coding: utf-8 -*-
"""Einmalige Umstellung: text_de/text_en + images[] + layout{} -> blocks[].

Aufruf: python scripts/migrate-blocks.py [--dry]

Das alte Modell kann Text nur ueber den Bildern zeigen: eine Textspalte,
darunter ein Raster. Das neue Modell ist eine Folge von Bloecken - Zeilen mit
Zellen (Bild oder Text) und ausdrueckliche Leerraum-Bloecke dazwischen. Damit
steht Text neben einem Bild, und jede Zeile hat ihre eigene Spaltenzahl.

Dieses Skript laeuft genau einmal. Es rechnet so um, dass die Seiten danach
aussehen wie vorher - die Pruefung dafuer steht in scripts/compare-render.py.

Zuordnung:
  text_de/text_en   -> erste Zeile mit einer Textzelle
  layout.text_gap   -> Leerraum-Block darunter (Vorgabe 96 mit Text, 64 ohne)
  images[]          -> Zeilen zu je layout.columns Zellen
  layout.gap        -> Spaltenabstand der Zeile UND Leerraum zwischen den Zeilen
                       (im alten Raster war beides derselbe Wert)
  images[].width    -> cell.fill (Prozent der Zelle, Vorgabe 100)
  images[].full_row -> eigene Zeile mit einer Zelle

Warum "fill" neben dem Zellenverhaeltnis stehen bleibt: das Verhaeltnis teilt
die Zeile auf, fill sagt, wie viel davon das Bild einnimmt. Wuerde man 55 %
stattdessen als leere Nachbarzelle ausdruecken, kaeme ein zusaetzlicher
Spaltenabstand dazwischen und das Bild wuerde schmaler als bisher
(gemessen: 277 -> 260 px bei haeutung-kosmetikmaske). Fuer die Kuenstlerin
sind beide dasselbe - sie zieht eine Kante, das Feld dahinter ist egal.
  images[].align    -> uebernommen; layout.align ist die Vorgabe dafuer
"""
import copy
import glob
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKS = os.path.join(ROOT, "content", "works")

# Vorgaben aus assets/site.css - hier noch einmal, damit die Umrechnung
# dieselben Zahlen trifft wie der bisherige Aufbau.
GAP_DEFAULT = 16          # --bp-space-sm
TEXTGAP_WITH_TEXT = 96    # --bp-space-xl
TEXTGAP_NO_TEXT = 64      # --bp-space-lg

# Reihenfolge wie bisher in .pages.yml, damit die Dateien ruhig bleiben
KEY_ORDER = ["order", "title", "title_en", "year", "year_label",
             "material_de", "material_en", "medium_de", "medium_en", "blocks"]


def as_int(value, lo, hi):
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        return None
    return max(lo, min(hi, n))


def text_cell(de="", en="", w=None):
    cell = {"t": "text", "de": de, "en": en}
    if w is not None:
        cell["w"] = w
    return cell


def image_cell(im, base_align, fill=None):
    cell = {"t": "img", "src": im["src"]}
    if fill is not None and fill != 100:
        cell["fill"] = fill
    align = im.get("align") or base_align
    if align and align != "left":
        cell["align"] = align
    for key in ("caption_de", "caption_en"):
        if im.get(key):
            cell[key] = im[key]
    return cell


def build_blocks(work):
    layout = work.get("layout") or {}
    base_align = layout.get("align") if layout.get("align") in ("left", "center", "right") else None
    columns = as_int(layout.get("columns"), 1, 4) or 1
    gap = as_int(layout.get("gap"), 0, 400)
    gap = GAP_DEFAULT if gap is None else gap
    images = [im for im in work.get("images", []) if im.get("src")]

    blocks = []
    text_de = work.get("text_de", "")
    text_en = work.get("text_en", "")
    if text_de or text_en:
        blocks.append({"t": "row", "gap": gap, "cells": [text_cell(text_de, text_en)]})

    # Abstand zwischen Kopf/Text und dem ersten Bild
    if images:
        text_gap = as_int(layout.get("text_gap"), 0, 400)
        if text_gap is None:
            text_gap = TEXTGAP_WITH_TEXT if text_de else TEXTGAP_NO_TEXT
        if text_gap:
            blocks.append({"t": "gap", "h": text_gap})

    # Bilder in Zeilen aufteilen - full_row bekommt eine eigene Zeile
    rows, current = [], []
    for im in images:
        if columns > 1 and im.get("full_row"):
            if current:
                rows.append(current)
                current = []
            rows.append([im])
            continue
        current.append(im)
        if len(current) == columns:
            rows.append(current)
            current = []
    if current:
        rows.append(current)

    for index, row_images in enumerate(rows):
        if index:
            blocks.append({"t": "gap", "h": gap})   # altes Raster: Zeilenabstand = gap
        full = len(row_images) == 1 and columns > 1 and row_images[0].get("full_row")
        track = 1 if full else columns
        cells = [image_cell(im, base_align, fill=as_int(im.get("width"), 10, 100))
                 for im in row_images]
        # angefangene Zeile mit leeren Zellen auffuellen, damit die Spalten
        # so breit bleiben wie im alten Raster
        if not full and len(cells) < track:
            cells += [text_cell() for _ in range(track - len(cells))]
        blocks.append({"t": "row", "gap": gap, "cells": cells})

    return blocks


def reorder(work):
    out = {}
    for key in KEY_ORDER:
        if key in work:
            out[key] = work[key]
    for key in work:                      # unbekannte Schluessel nicht verlieren
        if key not in out:
            out[key] = work[key]
    return out


def main():
    dry = "--dry" in sys.argv
    changed = 0
    for path in sorted(glob.glob(os.path.join(WORKS, "*.json"))):
        raw = io.open(path, encoding="utf-8").read()
        work = json.loads(raw)
        slug = os.path.basename(path)[:-5]
        if "blocks" in work:
            print(f"  {slug:26} schon umgestellt - uebersprungen")
            continue

        blocks = build_blocks(work)
        new = copy.deepcopy(work)
        for key in ("text_de", "text_en", "images", "layout"):
            new.pop(key, None)
        new["blocks"] = blocks
        new = reorder(new)

        rows = sum(1 for b in blocks if b["t"] == "row")
        gaps = sum(1 for b in blocks if b["t"] == "gap")
        cells = sum(len(b["cells"]) for b in blocks if b["t"] == "row")
        print(f"  {slug:26} {rows} Zeilen, {cells} Zellen, {gaps} Leerraeume")

        if not dry:
            io.open(path, "w", encoding="utf-8", newline="\n").write(
                json.dumps(new, ensure_ascii=False, indent=2))
        changed += 1

    print(f"\n{'(Probelauf) ' if dry else ''}umgestellt: {changed}")


if __name__ == "__main__":
    main()
