// The app's name with a small bone beside it.
function BrandMark() {
  return (
    <>
      <svg
        aria-hidden="true"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        style={{ flex: 'none' }}
      >
        <g fill="currentColor" transform="rotate(-45 12 12)">
          <rect x="5" y="9.5" width="14" height="5" />
          <circle cx="5" cy="8.5" r="3.5" />
          <circle cx="5" cy="15.5" r="3.5" />
          <circle cx="19" cy="8.5" r="3.5" />
          <circle cx="19" cy="15.5" r="3.5" />
        </g>
      </svg>
      <span>BoneScan3D</span>
    </>
  )
}

export default BrandMark
