import { describe, expect, test } from "bun:test";
import { GHL_DFY_PRICING, ghlDfyPaymentTotal } from "../src/config/ghlDfy";

describe("GHL DFY payment options", () => {
  test("paid-in-full price is $20,000", () => {
    expect(GHL_DFY_PRICING.paidInFull).toBe(20_000);
  });
  test("monthly payments are $5,000", () => {
    expect(GHL_DFY_PRICING.monthlyPayment).toBe(5_000);
  });
  test("payment plan lasts five months and totals $25,000", () => {
    expect(GHL_DFY_PRICING.paymentMonths).toBe(5);
    expect(ghlDfyPaymentTotal()).toBe(25_000);
  });
});