import { describe, expect, test } from "bun:test";
import { mockAccountShape } from "../src/lib/platformMock";

describe("mock account shapes", () => {
  test("the demo account has an agency, tickets, and HighLevel", () => {
    const shape = mockAccountShape("demo");
    expect(shape.user.agency_id).toBe("demo-agency");
    expect(shape.tickets.length).toBeGreaterThan(0);
    expect(shape.connected).toBe(true);
  });

  test("the empty account has no agency, tickets, or HighLevel connection", () => {
    const shape = mockAccountShape("empty");
    expect(shape.user.agency_id).toBeNull();
    expect(shape.user.agency_id_basic).toBeNull();
    expect(shape.user.agency_name).toBeNull();
    expect(shape.tickets).toEqual([]);
    expect(shape.connected).toBe(false);
  });
});
