import { describe, expect, test } from "bun:test";
import { hubLabelForAgency, hubLabelForSlot } from "../supabase/functions/chat-copilot/planLabels.ts";

describe("hub labels", () => {
  const account = { agency_id: "keystone", agency_id_advanced: "keystone-2", agency_id_elite: "keystone-3" };
  test("uses Hub 1/2/3 for the three agency ids", () => {
    expect(hubLabelForAgency(account, "keystone")).toBe("Hub 1");
    expect(hubLabelForAgency(account, "keystone-2")).toBe("Hub 2");
    expect(hubLabelForAgency(account, "keystone-3")).toBe("Hub 3");
    expect(hubLabelForSlot("basic")).toBe("Hub 1");
    expect(hubLabelForSlot("advanced")).toBe("Hub 2");
    expect(hubLabelForSlot("elite")).toBe("Hub 3");
  });
});
