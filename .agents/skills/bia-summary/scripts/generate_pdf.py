#!/usr/bin/env python3
"""
Genera un PDF da contenuto Markdown usando WeasyPrint.

Uso: python generate_pdf.py <input.md> <output.pdf>
     python generate_pdf.py --html <input.html> <output.pdf>
"""

import sys
import os
import markdown
from weasyprint import HTML, CSS
from pathlib import Path


# Percorso al file CSS
SKILL_DIR = Path(__file__).parent.parent
CSS_FILE = SKILL_DIR / "templates" / "style.css"


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Riassunto BIA</title>
</head>
<body>
{content}
</body>
</html>
"""


def markdown_to_html(md_content: str) -> str:
    """Converte Markdown in HTML."""
    html_body = markdown.markdown(
        md_content, 
        extensions=['tables', 'fenced_code', 'toc']
    )
    return HTML_TEMPLATE.format(content=html_body)


def generate_pdf(input_path: str, output_path: str, is_html: bool = False):
    """Genera PDF da file Markdown o HTML."""
    
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if is_html:
        html_content = content
    else:
        html_content = markdown_to_html(content)
    
    # Carica CSS
    css = None
    if CSS_FILE.exists():
        css = CSS(filename=str(CSS_FILE))
    
    # Genera PDF
    html = HTML(string=html_content)
    if css:
        html.write_pdf(output_path, stylesheets=[css])
    else:
        html.write_pdf(output_path)
    
    print(f"PDF generato: {output_path}")


def main():
    if len(sys.argv) < 3:
        print("Uso: python generate_pdf.py <input.md> <output.pdf>", file=sys.stderr)
        print("     python generate_pdf.py --html <input.html> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    
    is_html = False
    if sys.argv[1] == "--html":
        is_html = True
        input_path = sys.argv[2]
        output_path = sys.argv[3]
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    
    try:
        generate_pdf(input_path, output_path, is_html)
    except Exception as e:
        print(f"Errore: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
