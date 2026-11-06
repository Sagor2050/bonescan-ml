// Requirements A.6: the labels for the healing words a report uses. The reader
// records the words, and this only names them. A status never comes from dates
// or the time between reports (S5.3).
const LABELS: Record<string, string> = {
  acute: 'New',
  healing: 'Healing',
  'callus formation': 'Healing',
  'interval callus formation': 'Healing',
  'interval healing': 'Healing',
  healed: 'Healed',
  united: 'Healed',
  remodeled: 'Healed',
  remodelled: 'Healed',
  old: 'Healed',
  nonunion: 'Not healing',
  'non-union': 'Not healing',
  'delayed union': 'Not healing',
  malunion: 'Healed out of line',
  'mal-union': 'Healed out of line',
}

// A word with no label in A.6 is still the report's word, so it's quoted as it
// is rather than matched to the nearest label.
const NO_LABEL = 'Report says'

// The lines to show for a finding, each a label and the report's own words: for
// B.2, `Healing: “interval callus formation”, “healing”`. No words, no lines.
// A report whose words point two ways shows both, because choosing would be
// judging how the fracture is healing.
export function healingLines(words: string[]) {
  const groups = new Map<string, string[]>()
  for (const word of words) {
    const label = LABELS[word.trim().toLowerCase()] ?? NO_LABEL
    groups.set(label, [...(groups.get(label) ?? []), word])
  }
  return [...groups].map(
    ([label, grouped]) =>
      `${label}: ${grouped.map((word) => `“${word}”`).join(', ')}`,
  )
}
