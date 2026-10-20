import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            height: "100vh",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--pg-bg, #191817)",
            color: "var(--pg-text, #e8e6e3)",
            fontFamily: "var(--pg-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
            padding: "clamp(16px, 4vw, 32px)",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "min(92vw, 520px)",
              padding: "clamp(20px, 5vw, 36px)",
              backgroundColor: "var(--pg-bg-elevated, #22201e)",
              borderRadius: "12px",
              border: "1px solid var(--pg-border, #33302c)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
              boxSizing: "border-box",
            }}
          >
            <h2
              style={{
                fontSize: "clamp(1.1rem, 3vw, 1.35rem)",
                fontWeight: 600,
                margin: "0 0 12px 0",
                color: "var(--pg-text, #f0efed)",
              }}
            >
              Application Render Exception
            </h2>
            <p
              style={{
                color: "var(--pg-text-muted, #a8a49e)",
                fontSize: "clamp(0.85rem, 2.5vw, 0.95rem)",
                lineHeight: "1.5",
                margin: "0 0 20px 0",
                wordBreak: "break-word",
              }}
            >
              {this.state.error?.message || "An unexpected error occurred during rendering."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "var(--pg-primary, #3b82f6)",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "10px 20px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "clamp(0.85rem, 2vw, 0.95rem)",
                transition: "opacity 0.15s ease",
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
