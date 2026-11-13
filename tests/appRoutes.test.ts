import { describe, expect, test } from "bun:test";
import { DESIGN_PATH, DESIGN_TOOL, pathForAppTool, resolveAppTool } from "../src/lib/appRoutes";

describe("Client Hub Design routes", () => {
  test("client-hub/design renders Design and every other Client Hub path stays Edit Pages", () => {
    expect(resolveAppTool("client-hub", "design")).toBe(DESIGN_TOOL);
    expect(resolveAppTool("Client-Hub", "Design")).toBe("branding");
    expect(resolveAppTool("client-hub")).toBe("client-hub");
    expect(resolveAppTool("client-hub", "home")).toBe("client-hub");
    expect(resolveAppTool("client-hub", "pages")).toBe("client-hub");
    expect(resolveAppTool("branding")).toBe("branding");
    expect(resolveAppTool("support", "design")).toBe("support");
    expect(resolveAppTool(undefined)).toBeNull();
    expect(resolveAppTool("")).toBeNull();
  });

  test("sidebar Design navigates to the Client Hub Design URL", () => {
    expect(DESIGN_PATH).toBe("/app/client-hub/design");
    expect(pathForAppTool("branding")).toBe("/app/client-hub/design");
    expect(pathForAppTool("client-hub")).toBe("/app/client-hub");
    expect(pathForAppTool("dashboard")).toBe("/app/dashboard");
    expect(pathForAppTool("support")).toBe("/app/support");
  });
});
