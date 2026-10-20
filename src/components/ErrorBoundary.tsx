import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import Fault from './Fault'

interface State {
  message: string | null
}

/**
 * Without this, one bad render is a white screen - and on a phone there is no
 * console to look at and no obvious way back, so the app simply looks dead.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WordFlow stopped:', error, info.componentStack)
  }

  render() {
    if (this.state.message === null) return this.props.children
    return (
      <Fault title="Something went wrong" detail={this.state.message}>
        Reloading usually clears it. Your decks, stars and progress are kept in this browser and are not affected.
      </Fault>
    )
  }
}
