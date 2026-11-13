import { describe, expect, test } from "bun:test";
import { sessionBeaconCors } from "../supabase/functions/session-beacon/cors";

describe("session-beacon CORS", () => {
  test("echoes an http(s) origin and allows credentialed beacons", () => {
    for (const origin of ["https://saassuite.ai", "http://127.0.0.1:8080"]) {
      const headers = sessionBeaconCors(origin);
      expect(headers["Access-Control-Allow-Origin"]).toBe(origin);
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
      expect(headers.Vary).toBe("Origin");
    }
  });

  test("a missing or unsafe origin stays a wildcard without credentials", () => {
    for (const origin of [null, "", "null", "javascript:alert(1)", "file:///tmp/page"]) {
      const headers = sessionBeaconCors(origin);
      expect(headers["Access-Control-Allow-Origin"]).toBe("*");
      expect(headers["Access-Control-Allow-Credentials"]).toBeUndefined();
    }
  });
});
