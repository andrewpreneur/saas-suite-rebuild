import { expect, test } from "bun:test";
import { collapseHeadDuplicates } from "../src/hooks/useStripStaticSeo";

test("SEO cleanup detaches only static fallbacks, never React-owned duplicates", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  const nodes = [
    { static: true, attached: true },
    { static: false, attached: true },
    { static: false, attached: true },
  ].map((node) => ({
    ...node,
    remove() { this.attached = false; },
  }));
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { head: { querySelectorAll: (selector: string) =>
      selector === "[data-static-seo]" ? nodes.filter((node) => node.static && node.attached) : nodes.filter((node) => node.attached),
    } },
  });
  try {
    collapseHeadDuplicates();
    collapseHeadDuplicates();
    expect(nodes.map((node) => node.attached)).toEqual([false, true, true]);
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});