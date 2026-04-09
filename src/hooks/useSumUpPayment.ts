import { useState, useCallback } from 'react';
import { getSumUpCredentials } from '@/lib/services/sumup-credentials';

interface PaymentRequest {
  amount: number;
  currency: string;
  reader_id: string;
  description: string;
  pay_to_email?: string;
}

interface PaymentStatus {
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  checkout_id: string;
}

export function useSumUpPayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const getSumUpHeaders = useCallback((): Record<string, string> => {
    const creds = getSumUpCredentials();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (creds?.apiKey) headers['x-sumup-api-key'] = creds.apiKey;
    if (creds?.merchantCode) headers['x-sumup-merchant-code'] = creds.merchantCode;
    if (creds?.affiliateKey) headers['x-sumup-affiliate-key'] = creds.affiliateKey;
    return headers;
  }, []);

  const createCheckout = useCallback(async (paymentRequest: PaymentRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sumup/create-checkout', {
        method: 'POST',
        headers: getSumUpHeaders(),
        body: JSON.stringify(paymentRequest),
      });

      const data = await response.json();

      if (data.success) {
        setCheckoutId(data.checkout_id);
        return data.checkout_id;
      } else {
        setError(data.error || 'Failed to create checkout');
        return null;
      }
    } catch (error) {
      setError('Network error. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPaymentStatus = useCallback(async (checkoutId: string): Promise<PaymentStatus | null> => {
    try {
      const response = await fetch(`/api/sumup/checkout-status?checkoutId=${checkoutId}`, {
        headers: getSumUpHeaders(),
      });
      const data = await response.json();

      if (data.success) {
        return {
          status: data.status,
          checkout_id: data.checkout.id,
        };
      } else {
        setError(data.error || 'Failed to check payment status');
        return null;
      }
    } catch (error) {
      setError('Network error. Please try again.');
      return null;
    }
  }, []);

  const pollPaymentStatus = useCallback(
    (checkoutId: string, onStatusChange: (status: PaymentStatus) => void, interval: number = 2000) => {
      const pollInterval = setInterval(async () => {
        const status = await checkPaymentStatus(checkoutId);
        
        if (status) {
          onStatusChange(status);
          
          // Stop polling if payment is complete
          if (status.status === 'PAID' || status.status === 'FAILED' || status.status === 'CANCELLED') {
            clearInterval(pollInterval);
          }
        }
      }, interval);

      return () => clearInterval(pollInterval);
    },
    [checkPaymentStatus]
  );

  const reset = useCallback(() => {
    setCheckoutId(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    createCheckout,
    checkPaymentStatus,
    pollPaymentStatus,
    reset,
    getSumUpHeaders,
    loading,
    error,
    checkoutId,
  };
}
