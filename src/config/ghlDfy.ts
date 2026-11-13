export const GHL_DFY_PRICING = {
  paidInFull: 20_000,
  monthlyPayment: 5_000,
  paymentMonths: 5,
} as const;

export const ghlDfyPaymentTotal = () =>
  GHL_DFY_PRICING.monthlyPayment * GHL_DFY_PRICING.paymentMonths;