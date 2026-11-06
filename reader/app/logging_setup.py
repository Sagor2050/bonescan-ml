"""Keep report text out of the logs (Plan, Milestone 4; AGENTS.md).

medspaCy's sentence splitter, PyRuSH, logs every token at DEBUG level through
loguru, and pdfminer logs page content at DEBUG level. Import this before either
one handles a report.
"""

import logging

from loguru import logger

logger.remove()
logger.disable("PyRuSH")

for name in ("pdfminer", "pdfplumber"):
    logging.getLogger(name).setLevel(logging.ERROR)
