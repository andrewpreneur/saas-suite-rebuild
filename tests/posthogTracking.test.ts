import { expect, test } from "bun:test";
import { analyticsUrl, websiteEventProperties, websiteTrackingAllowed } from "../src/utils/posthogPolicy";

test("tracking is disabled for opted-out visitors even with a configured token", () => {
  expect(websiteTrackingAllowed(true, "configured")).toBe(false);
  expect(websiteTrackingAllowed(false, "configured")).toBe(true);
  expect(websiteTrackingAllowed(false, undefined)).toBe(false);
});
test("page URLs never send auth fragments or query strings", () => {
  expect(analyticsUrl("https://saassuite.ai/auth?email=private@example.com#access_token=secret")).toBe("https://saassuite.ai/auth");
});
test("event properties exclude personal and arbitrary captured content", () => {
  expect(websiteEventProperties({ distinct_id: "anonymous", "$current_url": "https://saassuite.ai/copilot?key=secret", email: "private@example.com", "$set": { name: "Private" }, "$title": "Private conversation", response: "private chat" })).toEqual({ distinct_id: "anonymous", "$current_url": "https://saassuite.ai/copilot" });
});