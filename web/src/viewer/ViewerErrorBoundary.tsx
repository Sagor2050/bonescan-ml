import { Component, type ReactNode } from 'react'

type ViewerErrorBoundaryProps = {
  fallback: ReactNode
  children: ReactNode
}

// Keeps the rest of the screen working when the browser can't draw 3D or the
// model can't be loaded.
class ViewerErrorBoundary extends Component<
  ViewerErrorBoundaryProps,
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default ViewerErrorBoundary
