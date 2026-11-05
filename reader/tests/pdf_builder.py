"""Build small text PDFs for tests using only the standard library."""


def _escape(line: str) -> str:
    return line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_pdf(pages: list[list[str]], page_options: str = "") -> bytes:
    """Return a PDF with one list of text lines per page.

    `page_options` is added to each page object, for example a CropBox.
    A page with no lines has no text in it, like a scanned report.
    """
    objects: list[bytes] = []
    page_ids = [3 + i * 2 for i in range(len(pages))]
    font_id = 3 + len(pages) * 2
    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    for page_id, lines in zip(page_ids, pages):
        operations = ["BT /F1 11 Tf"]
        for number, line in enumerate(lines):
            operations.append(f"1 0 0 1 72 {720 - number * 18} Tm ({_escape(line)}) Tj")
        operations.append("ET")
        content = "\n".join(operations).encode()
        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] {page_options} "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
                f"/Contents {page_id + 1} 0 R >>"
            ).encode()
        )
        objects.append(
            b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content)
        )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    output = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(output))
        output += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref = len(output)
    output += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    for offset in offsets:
        output += b"%010d 00000 n \n" % offset
    output += b"trailer << /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref,
    )
    return output
