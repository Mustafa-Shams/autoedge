/**
 * BankPage — full implementation per spec 8.1-8.2.
 * Bank card visual, statement table (date, ref, description, debit red/credit green,
 * balance_after), filter by type, pagination, top-up modal.
 */
import { useState, useEffect, useCallback } from 'react';
import * as storeApi from '../../api/storeApi';
import BankCard from '../../components/payment/BankCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import PasswordField from '../../components/forms/PasswordField';
import useAuth from '../../hooks/useAuth';
import { formatPrice, formatDateTime } from '../../utils/formatters';
import BackButton from '../../components/common/BackButton';

const TXN_TYPE_FILTERS = [
  { value: '', label: 'All Transactions' },
  { value: 'Debit', label: 'Debits Only' },
  { value: 'Credit', label: 'Credits Only' },
];

const PAGE_SIZE = 15;

export default function BankPage() {
  const { customer } = useAuth();

  // Bank summary
  const [bankSummary, setBankSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Sensitive data (full account number, demo CVV)
  const [sensitiveData, setSensitiveData] = useState(null);

  // Transactions
  const [transactions, setTransactions] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [txnPage, setTxnPage] = useState(1);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnFilter, setTxnFilter] = useState('');

  // Top-up modal
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpError, setTopUpError] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState('');

  // Error
  const [error, setError] = useState('');

  // Fetch bank summary
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const res = await storeApi.getBankSummary();
      setBankSummary(res.data);
      storeApi.getSensitiveBankDetails().then(r => setSensitiveData(r.data)).catch(() => {});
    } catch (err) {
      setError('Failed to load bank account.');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async (page = 1, filter = '') => {
    try {
      setLoadingTxns(true);
      const params = { page, page_size: PAGE_SIZE };
      if (filter) params.txn_type = filter;
      const res = await storeApi.getBankTransactions(params);
      setTransactions(res.data.items || res.data.transactions || []);
      setTxnTotal(res.data.total || 0);
    } catch {
      // Keep existing data
    } finally {
      setLoadingTxns(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchTransactions(1, txnFilter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filter changes
  useEffect(() => {
    setTxnPage(1);
    fetchTransactions(1, txnFilter);
  }, [txnFilter, fetchTransactions]);

  // Handle page change
  const handlePageChange = (newPage) => {
    setTxnPage(newPage);
    fetchTransactions(newPage, txnFilter);
  };

  // Handle top-up
  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount < 100 || amount > 50000) {
      setTopUpError('Amount must be between $100.00 and $50,000.00');
      return;
    }

    setTopUpLoading(true);
    setTopUpError('');
    setTopUpSuccess('');

    try {
      await storeApi.topUp({ amount });
      setTopUpSuccess(`Successfully added ${formatPrice(amount)} to your balance!`);
      setTopUpAmount('');
      // Refresh data
      await Promise.all([fetchSummary(), fetchTransactions(1, txnFilter)]);
      setTxnPage(1);
      // Auto-close after a moment
      setTimeout(() => {
        setShowTopUp(false);
        setTopUpSuccess('');
      }, 2000);
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (err.response?.status === 429 || detail.includes('5 top-ups') || detail.includes('rate') || detail.includes('limit')) {
        setTopUpError('You have reached the maximum of 5 top-ups in 24 hours. Please try again later.');
      } else {
        setTopUpError(detail || 'Top-up failed. Please try again.');
      }
    } finally {
      setTopUpLoading(false);
    }
  };

  const totalPages = Math.ceil(txnTotal / PAGE_SIZE);

  if (loadingSummary) return <LoadingSpinner fullPage text="Loading bank account…" />;

  if (error && !bankSummary) {
    return (
      <EmptyState
        title="Bank Account Unavailable"
        description={error}
        action={fetchSummary}
        actionLabel="Try Again"
      />
    );
  }

  return (
    <div>
      <BackButton fallback="/account" label="Back to Account" className="mb-4" />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bank Account</h1>
          <p className="text-text-secondary text-sm mt-1">Manage your AutoEdge Demo Bank account</p>
        </div>
        <button
          onClick={() => {
            setShowTopUp(true);
            setTopUpError('');
            setTopUpSuccess('');
            setTopUpAmount('');
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-accent-blue/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Top Up Balance
        </button>
      </div>

      {/* Bank card */}
      {bankSummary && (
        <BankCard
          bankName="AutoEdge Demo Bank"
          cardLast4={bankSummary.card_last4}
          customerName={customer?.full_name || bankSummary.customer_name || 'Account Holder'}
          balance={parseFloat(bankSummary.balance)}
          accountNumber={sensitiveData?.account_number}
          demoCvv={sensitiveData?.demo_cvv}
          className="mb-8 max-w-md"
        />
      )}

      {/* Demo note (Article XVIII) */}
      <div className="mb-6 p-3 bg-status-reserved/10 border border-status-reserved/20 rounded-lg">
        <p className="text-xs text-status-reserved">
          ⚠️ Demo project — no real money. This is a simulated bank account with demo funds.
          Use "Top Up Balance" to add more demo funds.
        </p>
      </div>

      {/* Statement section */}
      <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
        {/* Statement header */}
        <div className="flex items-center justify-between p-4 border-b border-bg-border">
          <h2 className="text-lg font-semibold text-text-primary">Statement</h2>
          <div className="flex items-center gap-2">
            <select
              value={txnFilter}
              onChange={(e) => setTxnFilter(e.target.value)}
              className="px-3 py-1.5 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
            >
              {TXN_TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Transactions table */}
        {loadingTxns ? (
          <LoadingSpinner text="Loading transactions…" />
        ) : transactions.length === 0 ? (
          <EmptyState
            title="No transactions"
            description={txnFilter ? 'No transactions match this filter.' : 'Your statement will appear here after your first transaction.'}
            className="py-12"
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-elevated text-text-muted text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-right font-medium">Debit</th>
                    <th className="px-4 py-3 text-right font-medium">Credit</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bg-border">
                  {transactions.map((txn, idx) => {
                    const isDebit = txn.txn_type === 'Debit';
                    return (
                      <tr key={txn.transaction_id || idx} className="hover:bg-bg-elevated/50 transition-colors">
                        <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                          {formatDateTime(txn.created_at)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                          {txn.reference_code}
                        </td>
                        <td className="px-4 py-3 text-text-primary">
                          {txn.description}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isDebit ? (
                            <span className="text-status-cancelled font-medium">
                              -{formatPrice(txn.amount)}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {!isDebit ? (
                            <span className="text-status-available font-medium">
                              +{formatPrice(txn.amount)}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-text-primary font-medium whitespace-nowrap">
                          {formatPrice(txn.balance_after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-bg-border">
              {transactions.map((txn, idx) => {
                const isDebit = txn.txn_type === 'Debit';
                return (
                  <div key={txn.transaction_id || idx} className="p-4">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm text-text-primary font-medium">{txn.description}</p>
                      <span className={`text-sm font-semibold ${isDebit ? 'text-status-cancelled' : 'text-status-available'}`}>
                        {isDebit ? '-' : '+'}{formatPrice(txn.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-text-muted">
                        {formatDateTime(txn.created_at)} · {txn.reference_code}
                      </p>
                      <p className="text-xs text-text-secondary">
                        Bal: {formatPrice(txn.balance_after)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-bg-border">
                <p className="text-xs text-text-muted">
                  Page {txnPage} of {totalPages} · {txnTotal} transaction{txnTotal !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(txnPage - 1)}
                    disabled={txnPage <= 1}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-bg-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(txnPage + 1)}
                    disabled={txnPage >= totalPages}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-bg-border rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Top-up Modal ──────────────────────────────────────── */}
      {showTopUp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTopUp(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-bg-card border border-bg-border rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-primary">Top Up Demo Balance</h3>
              <button
                onClick={() => setShowTopUp(false)}
                className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-elevated transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleTopUp}>
              <div className="mb-4">
                <label htmlFor="topup-amount" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                  <input
                    id="topup-amount"
                    type="number"
                    min="100"
                    max="50000"
                    step="0.01"
                    value={topUpAmount}
                    onChange={(e) => {
                      setTopUpAmount(e.target.value);
                      setTopUpError('');
                    }}
                    placeholder="1000.00"
                    className="w-full pl-7 pr-4 py-2.5 bg-bg-elevated border border-bg-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue"
                    required
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Min \$100.00 · Max \$50,000.00 · Up to 5 top-ups per 24 hours
                </p>
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[1000, 5000, 10000, 25000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setTopUpAmount(String(amt));
                      setTopUpError('');
                    }}
                    className="py-2 text-xs font-medium text-text-secondary bg-bg-elevated hover:bg-bg-border border border-bg-border rounded-lg transition-colors"
                  >
                    {formatPrice(amt, false)}
                  </button>
                ))}
              </div>

              {topUpError && (
                <div className="mb-4 p-3 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
                  <p className="text-xs text-status-cancelled">{topUpError}</p>
                </div>
              )}

              {topUpSuccess && (
                <div className="mb-4 p-3 bg-status-available/10 border border-status-available/20 rounded-lg">
                  <p className="text-xs text-status-available">{topUpSuccess}</p>
                </div>
              )}

              <p className="text-[11px] text-text-muted text-center mb-4">
                ⚠️ Demo project — these are simulated funds, not real money.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTopUp(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topUpLoading || !topUpAmount}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
                >
                  {topUpLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding…
                    </>
                  ) : (
                    `Add ${topUpAmount ? formatPrice(parseFloat(topUpAmount) || 0) : 'Funds'}`
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
