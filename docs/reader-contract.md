# Report reader contract

This is the findings format between the web app and the report reader. It
fills in what [Plan B.2](project-plan.pdf) leaves open. It was fixed in #32, and
changing it needs agreement from both the web app and the reader sides.

- Python: `reader/app/contract.py`
- TypeScript: `web/src/findings/types.ts`
- Sample responses both sides test against: `tests/fixtures/read-*.json`

## Request

`POST /read` as `multipart/form-data`, with exactly one of these fields:

| Field  | Holds                |
| ------ | -------------------- |
| `file` | A PDF file           |
| `text` | Pasted report text   |

Send the signed-in user's Supabase access token as
`Authorization: Bearer <token>`.

## Responses

| Status | Meaning                                  | Body                  |
| ------ | ---------------------------------------- | --------------------- |
| 200    | The report was read                      | `ReadResponse`        |
| 401    | The token is missing or not valid        | None the app relies on |
| 422    | The report was refused, or the request has neither or both fields | `Refusal`, when refused |

A refusal is `{ "refusal": code, "message": text }`, where `code` is `not_pdf`,
`too_large`, `too_many_pages`, or `no_text`. Show `message` to the patient.
Nothing is kept in any of these cases.

## ReadResponse

- `text`: the report text, as extracted or pasted.
- `exam_date`: `YYYY-MM-DD` if the report states exactly one exam date,
  otherwise `null`.
- `candidate_dates`: the dates to choose between when there isn't exactly one.
  Empty when `exam_date` is set, or when the report states no date.
- `findings`: the proposed findings, with the fields below.

## Finding

| Field                | Values                                                               |
| -------------------- | -------------------------------------------------------------------- |
| `bone`               | A `bone` from `bones.json`, or empty if it isn't one or isn't stated |
| `side`               | `left`, `right`, or empty                                            |
| `part`               | Keys of that bone's `parts`. Empty means the whole bone              |
| `type_words`         | Fracture-type and alignment words                                    |
| `certainty`          | `certain` or `uncertain`                                             |
| `healing_words`      | The report's healing words. Empty if none                            |
| `status`             | `placed`, `outside_coverage`, `side_not_stated`, or `bone_not_stated` |
| `wording`            | The report wording it came from                                      |
| `entered_by_patient` | Always `false` from the reader                                       |

The model node for a placed finding is `bone` + `_` + `side`. See `boneId` in
`web/src/findings/types.ts`.

## Wording

Each piece of wording has `text`, with any line breaks replaced by one space.
A finding described in both Findings and Impression has two pieces.

- **From a PDF:** `page` (counted from 1) and `boxes`, one per line of text.
  Each box is `[x0, top, x1, bottom]` in PDF points from the top-left corner of
  the page as displayed, after any crop or rotation. To draw a box in PDF.js,
  multiply each number by the viewport's `scale`.
- **From pasted text:** `start` and `end`, a character range in the response's
  `text`.

## Corrections to Plan B.2

The example in Plan B.2 repeats the Impression sentence in both `wording`
entries. The first entry is the Findings sentence, as in
`tests/fixtures/read-b1-pdf.json`. Its boxes were made-up numbers. The samples
use the real positions from `tests/fixtures/report-b1.pdf`.
