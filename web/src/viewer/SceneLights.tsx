// The same lighting everywhere the skeleton appears. A strong light from the upper
// front gives the bones shape, so they stand out from the pale background.
function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={2.1} />
      <directionalLight position={[-2, 1, 2]} intensity={0.5} />
      <directionalLight position={[-1, 1, -3]} intensity={1} />
    </>
  )
}

export default SceneLights
