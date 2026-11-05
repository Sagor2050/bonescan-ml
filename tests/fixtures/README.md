# Test fixtures

Everything here is fictional. No real patient data goes in this folder.

- `report-b1.*` and `report-b2.*` are the two reports in Requirements
  Appendix B, written by the team, as a text file and as a PDF.
- `read-b1-pdf.json`, `read-b1-pasted.json`, `read-b2-pdf.json`, and
  `read-b2-pasted.json` are the exact responses `POST /read` must return for
  them. See [docs/reader-contract.md](../../docs/reader-contract.md).

Both `reader/` and `web/` test against these same files, so a change here is a
change to the contract and needs both sides to agree.

The PDFs were built with `reader/tests/pdf_builder.py`.
