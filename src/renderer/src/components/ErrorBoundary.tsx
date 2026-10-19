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
          style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#191817",
            color: "#e8e6e3",
            fontFamily: "Inter, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              padding: "32px",
              backgroundColor: "#22201e",
              borderRadius: "8px",
              border: "1px solid #33302c",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", margin: "0 0 12px 0", color: "#f0efed" }}>
              Application Render Exception
            </h2>
            <p style={{ color: "#a8a49e", fontSize: "0.9rem", lineHeight: "1.5", margin: "0 0 16px 0" }}>
              {this.state.error?.message || "An unexpected error occurred during rendering."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "#3273dc",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 16px",
                cursor: "pointer",
                fontWeight: 500,
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
