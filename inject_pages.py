# -*- coding: utf-8 -*-
"""Inserta fa-config, fa-gate y fa-flow en las páginas HTML del sitio."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HEAD_SNIPPET = (
    '<script src="assets/fa-config.js"></script>\n'
    '<script src="assets/fa-gate.js"></script>\n'
    '<script src="assets/fa-flow.js"></script>\n'
)
SIM_OLD = "Pago simulado: no se cobra nada."
SIM_NEW = "El pago se hace a través de Flow, la pasarela chilena."

def inject(html: str) -> str:
    if "assets/fa-config.js" not in html:
        needle = '<meta charset="utf-8">'
        if needle in html:
            html = html.replace(needle, needle + "\n" + HEAD_SNIPPET, 1)
        elif "<head>" in html:
            html = html.replace("<head>", "<head>\n" + HEAD_SNIPPET, 1)
        else:
            raise SystemExit("no <head> found")
    if SIM_OLD in html:
        html = html.replace(SIM_OLD, SIM_NEW)
    return html

def main():
    files = sorted(ROOT.glob("*.html"))
    if not files:
        raise SystemExit(f"no html in {ROOT}")
    for path in files:
        raw = path.read_text(encoding="utf-8")
        out = inject(raw)
        if out != raw:
            path.write_text(out, encoding="utf-8")
            print("updated", path.name)
        else:
            print("unchanged", path.name)

if __name__ == "__main__":
    main()