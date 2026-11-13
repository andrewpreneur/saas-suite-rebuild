import { Component, lazy, type ComponentType, type ReactNode } from "react";
import { isChunkLoadError, shouldReloadForChunkError } from "./chunkReload";

type Factory<T> = () => Promise<{ default: ComponentType<T> }>;

/**
 * A stale index.html (cached by a browser or CDN) points at chunk files that no
 * longer exist after a deploy, so the dynamic import rejects and the page stays
 * blank. Retry once, then hard-reload the app a single time to pick up the new
 * asset manifest.
 */
export function lazyRoute<T>(factory: Factory<T>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;
      try {
        return await factory();
      } catch (second) {
        if (shouldReloadForChunkError()) {
          window.location.reload();
          // Keep the promise pending while the reload happens.
          return await new Promise<{ default: ComponentType<T> }>(() => {});
        }
        throw second;
      }
    }
  });
}

type BoundaryState = { error: Error | null };

export class RouteErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[route]", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-semibold text-foreground">This page didn&apos;t load</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Something went wrong while opening this page. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Reload page
        </button>
      </div>
    );
  }
}
