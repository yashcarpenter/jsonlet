import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from './ui'

type Props = { children: ReactNode; onReset?: () => void; scope?: string }
type State = { error: Error | null }

/** Last line of defence: a rendering bug must never leave the user with a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('Jsonlet render error:', error)
  }
  reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 bg-surface p-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 text-error">
          <AlertTriangle size={20} />
        </span>
        <h2 className="text-[15px] font-semibold">Something went wrong{this.props.scope ? ` in ${this.props.scope}` : ''}</h2>
        <p className="max-w-md text-muted">Your JSON has not been changed or sent anywhere. You can go back and try again.</p>
        <pre className="max-w-xl overflow-auto rounded-md border border-line bg-sunken px-3 py-2 text-left font-mono text-[11.5px] text-muted">{this.state.error.message}</pre>
        <div className="flex gap-2">
          <Button onClick={this.reset}>
            <RotateCcw size={13} /> {this.props.onReset ? 'Back to editor' : 'Try again'}
          </Button>
          <Button variant="ghost" onClick={() => location.assign(location.pathname)}>
            Reload app
          </Button>
        </div>
      </div>
    )
  }
}
