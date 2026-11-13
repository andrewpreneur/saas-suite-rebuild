import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/** One id per build process so the bundle and /version.json always match. */
export function createBuildId(now = new Date()): string {
  const fromEnv = process.env.APP_BUILD_ID?.trim();
  let sha = "";
  if (fromEnv) sha = fromEnv;
  else {
    try {
      sha = execSync("git rev-parse --short=12 HEAD", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      sha = "dev";
    }
  }
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `${sha.slice(0, 80)}-${stamp}`;
}

function sendVersion(res: ServerResponse, payload: string) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.end(payload);
}

function attach(middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }, payload: string) {
  middlewares.use((req, res, next) => {
    const path = (req.url || "").split("?")[0];
    if (path !== "/version.json") return next();
    sendVersion(res, payload);
  });
}

export function appVersionPlugin(buildId = createBuildId()): Plugin {
  const payload = JSON.stringify({ id: buildId });
  return {
    name: "app-version",
    config() {
      return { define: { __APP_BUILD_ID__: JSON.stringify(buildId) } };
    },
    configureServer(server) {
      // Dev server and the running bundle share this process, so the id matches.
      attach(server.middlewares, payload);
    },
    configurePreviewServer(server) {
      // Preview serves the already-built bundle. A new id here would look stale.
      server.middlewares.use((req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (path !== "/version.json") return next();
        try {
          sendVersion(res, readFileSync(resolve("dist/version.json"), "utf8"));
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: payload });
    },
  };
}
