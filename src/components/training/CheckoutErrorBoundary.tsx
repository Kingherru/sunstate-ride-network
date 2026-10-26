import { Component, type ReactNode } from 'react';
export class CheckoutErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <p role="alert" className="rounded-ds border border-ds-error bg-ds-error-soft p-4 text-ds-error">{this.state.error}</p> : this.props.children; }
}