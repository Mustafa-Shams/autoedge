import { Component } from "react";
import BackButton from "./BackButton";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-6">
          <div className="bg-bg-card border border-bg-border rounded-2xl p-8 max-w-md w-full text-center space-y-5">
            <div className="mx-auto w-14 h-14 bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-status-cancelled" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-text-muted">
                An unexpected error occurred. Try going back or refreshing the
                page.
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <BackButton fallback="/dashboard" />
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent-blue hover:bg-accent-blueHover text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
