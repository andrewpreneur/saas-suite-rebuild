import { describe, expect, test } from "bun:test";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, ghlStillLoading, withDeadline } from "../src/lib/loadSettle";

describe("loaders settle", () => {
  test("a request that never returns becomes an error", async () => {
    await expect(withDeadline(new Promise(() => {}), 20)).rejects.toThrow(LOAD_TIMEOUT_MESSAGE);
  });

  test("a loader that never finishes can be turned into an error", async () => {
    let message = "";
    const stop = armLoadDeadline(() => {
      message = LOAD_TIMEOUT_MESSAGE;
    }, 20);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(message).toBe(LOAD_TIMEOUT_MESSAGE);
    stop();
  });

  test("a finished request is returned", async () => {
    await expect(withDeadline(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  test("no agency and no HighLevel connection stop the spinner", () => {
    expect(
      ghlStillLoading({
        email: "owner@example.com",
        agencyLookupDone: true,
        agencyId: null,
        snapshotSettled: false,
      }),
    ).toBe(false);
    expect(
      ghlStillLoading({
        email: null,
        agencyLookupDone: false,
        agencyId: null,
        snapshotSettled: false,
      }),
    ).toBe(false);
    expect(
      ghlStillLoading({
        email: "owner@example.com",
        agencyLookupDone: true,
        agencyId: "demo",
        snapshotSettled: false,
      }),
    ).toBe(true);
    expect(
      ghlStillLoading({
        email: "owner@example.com",
        agencyLookupDone: true,
        agencyId: "demo",
        snapshotSettled: true,
      }),
    ).toBe(false);
  });
});
