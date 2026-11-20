/**
 * EMI (Equated Monthly Instalment) calculator — pure frontend, per spec 11.4.
 *
 * Formula:
 *   r = annualRate / 12 / 100    (monthly interest rate as decimal)
 *   If r = 0: EMI = principal / n
 *   Else:     EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 *
 * All calculations use standard JS numbers — this is display-only,
 * not transactional money (Article XI allows it for the calculator).
 */

/**
 * Calculate EMI details.
 * @param {object} params
 * @param {number} params.price          — vehicle price (total)
 * @param {number} params.downPaymentPct — down payment percentage (0-100, default 20)
 * @param {number} params.annualRate     — annual interest rate percentage (default 7.5)
 * @param {number} params.termMonths     — loan term in months (default 60)
 * @returns {{ emi: number, principal: number, downPayment: number, totalInterest: number, totalPayable: number, termMonths: number }}
 */
export function calculateEmi({
  price,
  downPaymentPct = 20,
  annualRate = 7.5,
  termMonths = 60,
}) {
  if (!price || price <= 0 || termMonths <= 0 || downPaymentPct < 0 || downPaymentPct > 100) {
    return {
      emi: 0,
      principal: 0,
      downPayment: 0,
      totalInterest: 0,
      totalPayable: 0,
      termMonths: 0,
    };
  }

  const downPayment = (price * downPaymentPct) / 100;
  const principal = price - downPayment; // loan amount
  const n = termMonths;
  const r = annualRate / 12 / 100; // monthly rate as decimal

  let emi;
  if (r === 0) {
    // Zero interest — simple division
    emi = principal / n;
  } else {
    // Standard EMI formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
    const compoundFactor = Math.pow(1 + r, n);
    emi = (principal * r * compoundFactor) / (compoundFactor - 1);
  }

  const totalPayable = emi * n + downPayment;
  const totalInterest = totalPayable - price;

  return {
    emi: Math.round(emi * 100) / 100,
    principal: Math.round(principal * 100) / 100,
    downPayment: Math.round(downPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPayable: Math.round(totalPayable * 100) / 100,
    termMonths: n,
  };
}

/**
 * Available term options (months).
 */
export const TERM_OPTIONS = [12, 24, 36, 48, 60, 72];

/**
 * Default EMI parameters.
 */
export const EMI_DEFAULTS = {
  downPaymentPct: 20,
  annualRate: 7.5,
  termMonths: 60,
};
