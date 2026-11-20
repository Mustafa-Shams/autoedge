/**
 * EmiPage — full EMI calculator per spec 11.4.
 * Inputs: price, down payment %, annual interest %, term months (12/24/36/48/60/72).
 * Shows monthly EMI, total interest, total payable.
 * Button "Ask about finance" creates a prefilled enquiry (login required).
 */
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { calculateEmi, EMI_DEFAULTS, TERM_OPTIONS } from '../../utils/emi';
import { formatPrice } from '../../utils/formatters';
import useAuth from '../../hooks/useAuth';

export default function EmiPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loggedIn } = useAuth();

  const defaultPrice = parseFloat(searchParams.get('price')) || 35000;

  const [inputs, setInputs] = useState({
    price: defaultPrice,
    downPaymentPct: EMI_DEFAULTS.downPaymentPct,
    annualRate: EMI_DEFAULTS.annualRate,
    termMonths: EMI_DEFAULTS.termMonths,
  });

  const result = calculateEmi(inputs);

  const handleChange = (key, value) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const inputClasses = 'w-full px-4 py-3 bg-bg-elevated border border-bg-border rounded-xl text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-text-primary mb-2">EMI Calculator</h1>
        <p className="text-text-secondary">Calculate your monthly car loan payments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="bg-bg-card border border-bg-border rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-text-primary">Loan Details</h2>

          <div>
            <label htmlFor="emi-price" className="block text-sm text-text-secondary mb-1.5">Vehicle Price (\$)</label>
            <input
              id="emi-price"
              type="number"
              min="1000"
              step="100"
              value={inputs.price}
              onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
              className={inputClasses}
              aria-label="Vehicle price in dollars"
            />
          </div>

          <div>
            <label htmlFor="emi-down-payment" className="block text-sm text-text-secondary mb-1.5">
              Down Payment ({inputs.downPaymentPct}%)
            </label>
            <input
              id="emi-down-payment"
              type="range"
              min="0"
              max="80"
              step="5"
              value={inputs.downPaymentPct}
              onChange={(e) => handleChange('downPaymentPct', parseFloat(e.target.value))}
              className="w-full accent-accent-blue"
              aria-label="Down payment percentage"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>0%</span>
              <span className="font-medium text-text-secondary">{formatPrice(result.downPayment)}</span>
              <span>80%</span>
            </div>
          </div>

          <div>
            <label htmlFor="emi-interest-rate" className="block text-sm text-text-secondary mb-1.5">
              Annual Interest Rate ({inputs.annualRate}%)
            </label>
            <input
              id="emi-interest-rate"
              type="range"
              min="0"
              max="25"
              step="0.5"
              value={inputs.annualRate}
              onChange={(e) => handleChange('annualRate', parseFloat(e.target.value))}
              className="w-full accent-accent-blue"
              aria-label="Annual interest rate percentage"
            />
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>0%</span>
              <span>25%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">Loan Term</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {TERM_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => handleChange('termMonths', t)}
                  className={`py-2 text-sm rounded-lg border transition-colors ${
                    inputs.termMonths === t
                      ? 'bg-accent-blue text-white border-accent-blue'
                      : 'bg-bg-elevated text-text-secondary border-bg-border hover:border-accent-blue/50'
                  }`}
                >
                  {t}mo
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {/* Monthly EMI hero */}
          <div className="bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/20 rounded-xl p-8 text-center">
            <p className="text-sm text-text-secondary mb-2">Monthly EMI</p>
            <p className="text-4xl font-bold text-accent-blue">{formatPrice(result.emi)}</p>
            <p className="text-xs text-text-muted mt-2">per month for {result.termMonths} months</p>
          </div>

          {/* Breakdown */}
          <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
            <div className="px-6 py-3 border-b border-bg-border">
              <h3 className="text-sm font-semibold text-text-primary">Breakdown</h3>
            </div>
            <div className="divide-y divide-bg-border">
              <div className="flex justify-between px-6 py-3">
                <span className="text-sm text-text-secondary">Vehicle Price</span>
                <span className="text-sm font-medium text-text-primary">{formatPrice(inputs.price)}</span>
              </div>
              <div className="flex justify-between px-6 py-3">
                <span className="text-sm text-text-secondary">Down Payment ({inputs.downPaymentPct}%)</span>
                <span className="text-sm font-medium text-text-primary">−{formatPrice(result.downPayment)}</span>
              </div>
              <div className="flex justify-between px-6 py-3">
                <span className="text-sm text-text-secondary">Loan Amount</span>
                <span className="text-sm font-medium text-text-primary">{formatPrice(result.principal)}</span>
              </div>
              <div className="flex justify-between px-6 py-3">
                <span className="text-sm text-text-secondary">Total Interest</span>
                <span className="text-sm font-medium text-status-reserved">{formatPrice(result.totalInterest)}</span>
              </div>
              <div className="flex justify-between px-6 py-3 bg-bg-elevated/50">
                <span className="text-sm font-semibold text-text-primary">Total Payable</span>
                <span className="text-sm font-bold text-text-primary">{formatPrice(result.totalPayable)}</span>
              </div>
            </div>
          </div>

          {/* Visual breakdown bar */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Payment Composition</h3>
            <div className="h-4 rounded-full overflow-hidden flex bg-bg-elevated">
              <div
                className="bg-accent-blue h-full transition-all"
                style={{ width: `${inputs.price > 0 ? (result.principal / result.totalPayable) * 100 : 0}%` }}
                title={`Principal: ${formatPrice(result.principal)}`}
              />
              <div
                className="bg-status-reserved h-full transition-all"
                style={{ width: `${inputs.price > 0 ? (result.totalInterest / result.totalPayable) * 100 : 0}%` }}
                title={`Interest: ${formatPrice(result.totalInterest)}`}
              />
              <div
                className="bg-status-available h-full transition-all"
                style={{ width: `${inputs.price > 0 ? (result.downPayment / result.totalPayable) * 100 : 0}%` }}
                title={`Down Payment: ${formatPrice(result.downPayment)}`}
              />
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-accent-blue rounded-full" /> Loan</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-status-reserved rounded-full" /> Interest</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-status-available rounded-full" /> Down Payment</span>
            </div>
          </div>

          {/* Ask about finance */}
          <button
            onClick={() => {
              if (!loggedIn) {
                navigate('/login?next=' + encodeURIComponent('/emi-calculator'));
              }
              // TODO: prefilled enquiry in P40
            }}
            className="w-full py-3 bg-accent-blue hover:bg-accent-blue-hover text-white font-semibold rounded-xl transition-colors"
          >
            Ask about finance
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-8 bg-status-reserved/10 border border-status-reserved/20 rounded-xl p-4">
        <p className="text-xs text-text-secondary">
          <strong className="text-status-reserved">Note:</strong> This calculator provides estimates for illustration purposes only.
          Actual loan terms, interest rates, and eligibility may vary. This is a demo project — no real financing is available.
        </p>
      </div>
    </div>
  );
}
