import React from "react";

type FallbackRenderer = (props: { error: Error; reset: () => void }) => React.ReactNode;

type ErrorBoundaryProps = {
    fallback: FallbackRenderer;
    onError?: (error: Error, info: React.ErrorInfo) => void;
    children?: React.ReactNode;
};

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        this.props.onError?.(error, info);
        // eslint-disable-next-line no-console
        console.error("ErrorBoundary caught an error", error, info);
    }

    private reset = (): void => {
        this.setState({ error: null });
    };

    render(): React.ReactNode {
        const { error } = this.state;
        if (error) {
            return this.props.fallback({ error, reset: this.reset });
        }
        return this.props.children;
    }
}
