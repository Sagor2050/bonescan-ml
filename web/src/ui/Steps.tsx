import { CheckIcon } from './icons.tsx'
import styles from './Steps.module.css'

const STEPS = ['Add your report', 'Check the findings', 'See it on the skeleton']

// Where the patient is in adding a report, so it's clear there's a check before
// anything is saved. A number or a tick as well as color, for NFR12.
function Steps({ current }: { current: 1 | 2 }) {
  return (
    <ol className={styles.steps} aria-label="Steps to add a report">
      {STEPS.map((label, index) => {
        const number = index + 1
        const done = number < current
        const here = number === current
        return (
          <li
            key={label}
            className={here ? styles.here : done ? styles.done : undefined}
            aria-current={here ? 'step' : undefined}
          >
            <span className={styles.number}>
              {done ? <CheckIcon /> : number}
            </span>
            {label}
          </li>
        )
      })}
    </ol>
  )
}

export default Steps
