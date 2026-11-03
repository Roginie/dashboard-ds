import { Component, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <div className="card m-6 p-6 text-sm">
          <h2 className="mb-2 text-lg font-semibold text-rose-500">Algo deu errado nesta página</h2>
          <p className="mb-4 text-slate-500">{this.state.error.message}</p>
          <button className="btn" onClick={() => this.setState({ error: null })}>
            Tentar novamente
          </button>
        </div>
      );
    return this.props.children;
  }
}
