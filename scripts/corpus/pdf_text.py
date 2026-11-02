"""Extract text from a PDF for excerpt verification (scripts/corpus/ingest.ts, format pdf_excerpt).

  uv run --no-project --with pdfminer.six==20250506 python -I scripts/corpus/pdf_text.py <file.pdf>

Prints the text of all pages; only used to check that quoted excerpts occur in the document.
(pypdf garbles the Japanese fonts of the Tokyo Metropolitan Government PDFs; pdfminer reads them.)
"""

import sys

from pdfminer.high_level import extract_text

print(extract_text(sys.argv[1]))
