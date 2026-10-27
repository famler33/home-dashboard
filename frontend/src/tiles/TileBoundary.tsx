import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

export class TileBoundary extends Component<Props, { crashed: boolean }> {
  override state = { crashed: false };

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('tile crashed', error.name, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}
