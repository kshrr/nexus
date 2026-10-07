import { Component } from 'react';

/**
 * Top-level error boundary. Catches render-time exceptions so a single broken
 * screen never blanks the whole app (NFR03a: "without crashing").
 *
 * Class component because React error boundaries have no hook equivalent.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    /** @type {{ hasError: boolean, error: Error | null }} */
    this.state = { hasError: false, error: null };
  }

  /** @param {Error} error */
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  /** @param {Error} error @param {{ componentStack: string }} info */
  componentDidCatch(error, info) {
    // No telemetry service in this phase — log for local debugging only.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-paper px-6">
        <div className="max-w-prose text-center">
          <h1 className="text-h1 font-serif">Something broke on our side</h1>
          <p className="mt-3 text-body text-ink-700">
            The page hit an unexpected error. Reloading usually fixes it. If it keeps happening, try
            again later.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-6 inline-flex h-10 items-center rounded-input bg-pine-700 px-4 text-body-sm font-medium text-white hover:bg-pine-500"
          >
            Reload Nexus
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-6 overflow-x-auto rounded-card border border-ink-300 bg-surface p-4 text-left text-caption text-rust-600">
              {String(this.state.error?.stack ?? this.state.error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
