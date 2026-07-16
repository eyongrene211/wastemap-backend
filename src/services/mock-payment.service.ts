/**
 * Mock Payment Service — Simulates Fapshi/PayUnit for testing
 * All calls return immediately with a success status.
 * To simulate failure, use phone: "670000001" (or any ending with "001").
 */

export interface MockPaymentResponse {
  transId: string;
  status: "SUCCESSFUL" | "FAILED";
}

export const mockCollectPayment = async (params: {
  amount: number;
  phone: string;
  externalId?: string;
}): Promise<MockPaymentResponse> => {
  // Simulate network delay (500ms)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Simulate failure if phone ends with "001"
  if (params.phone.endsWith("001")) {
    throw new Error("MOCK_PAYMENT_FAILED: Payment rejected by provider");
  }

  const transId = `MOCK_COLL_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return { transId, status: "SUCCESSFUL" };
};

export const mockPayoutToCollector = async (params: {
  amount: number;
  phone: string;
  externalId?: string;
}): Promise<MockPaymentResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const transId = `MOCK_PAYOUT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return { transId, status: "SUCCESSFUL" };
};

export const mockGetStatus = async (transId: string): Promise<{ status: string }> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  if (transId.startsWith("MOCK_") || transId.startsWith("PAYOUT_")) {
    return { status: "SUCCESSFUL" };
  }
  return { status: "FAILED" };
};