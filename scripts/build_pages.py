"""Assemble the hand-edited pages from the shared fragments.

index.html, leads.html and outreach.html are each _head + _nav + their body
file + _foot, so the header and footer are defined once. Run this after
editing anything in scripts/. The two vendored pool pages are built by
build_pool.py, which reads the same fragments.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRAG = os.path.join(ROOT, "scripts")

PAGES = [
    ("index.html", "Dashboard",
     "SDL Creations dashboard — leads, pool finder and outreach."),
    ("leads.html", "Leads",
     "NSW architects and landscape designers — filter, tick and copy contact details."),
    ("outreach.html", "Outreach",
     "SDL Creations outreach — placeholder."),
]

read = lambda *p: open(os.path.join(*p), encoding="utf-8").read()
head, nav, foot = (read(FRAG, "_head.html"), read(FRAG, "_nav.html"),
                   read(FRAG, "_foot.html"))

for name, title, desc in PAGES:
    body = read(FRAG, "pages", name[:-5] + ".body.html")
    out = os.path.join(ROOT, name)
    open(out, "w", encoding="utf-8").write(
        head.replace("__TITLE__", title).replace("__DESC__", desc) + nav + body + foot)
    print("wrote", name)
