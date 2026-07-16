import { PayunitClient } from "@payunit/nodejs-sdk";
import { env }           from "../config/env";

console.log({
  baseURL: "https://gateway.payunit.net",
  apiKey: env.PAYUNIT_API_KEY,
  apiUsername: env.PAYUNIT_API_USER,
  apiPassword: env.PAYUNIT_API_PASSWORD,
  mode: env.PAYUNIT_MODE as "test" | "live",
  timeout: 10000,
});


export const payunitClient = new PayunitClient({
  baseURL: "https://gateway.payunit.net",
  apiKey: env.PAYUNIT_API_KEY,
  apiUsername: env.PAYUNIT_API_USER,
  apiPassword: env.PAYUNIT_API_PASSWORD,
  mode: env.PAYUNIT_MODE as "test" | "live",
  timeout: 10000,
});

// ─── Step A: Collect payment from resident (mobile money) ───
export const collectPayment = async (params: {
  amount: number;
  phone: string;
  transactionId: string;
  gateway: "CM_MTNMOMO" | "CM_ORANGE";
}) => {

  console.log({
    total_amount: params.amount,
    currency: "XAF",
    transaction_id: params.transactionId,
    gateway: params.gateway,
    phone_number: params.phone,
    return_url: env.PAYUNIT_RETURN_URL,
    notify_url: env.PAYUNIT_NOTIFY_URL,
    payment_country: "CM",
    redirect_on_failed: "yes",
    custom_fields: {
      pickupRequestId: params.transactionId,
    },
  });
  

  const result = await payunitClient.collections.initiateAndMakePaymentMobileMoney({
    total_amount: params.amount,
    currency: "XAF",
    transaction_id: params.transactionId,
    gateway: params.gateway,
    phone_number: params.phone,
    return_url: env.PAYUNIT_RETURN_URL,
    notify_url: env.PAYUNIT_NOTIFY_URL,
    payment_country: "CM",
    redirect_on_failed: "yes",
    custom_fields: {
      pickupRequestId: params.transactionId,
    },
  }) as any;

  return result;
};

// ─── Step B: Check payment status ───
export const getPaymentStatus = async (transactionId: string) => {
  const result = await payunitClient.collections.getTransactionStatus(
    transactionId
  ) as any;
  return result;
};

// ─── Step C: Payout to collector ───
export const payoutToCollector = async (params: {
  amount: number;
  collectorPhone: string;
  collectorName: string;
  gateway: "CM_MTNMOMO" | "CM_ORANGE";
  transactionId: string;
}) => {
  // 1. Create disbursement
  const disbursement = await payunitClient.disbursement.createDisbursement({
    destination_currency: "XAF",
    debit_currency: "XAF",
    account_number: params.collectorPhone,
    amount: params.amount,
    beneficiary_name: params.collectorName,
    deposit_type: "MOBILE_MONEY",
    transaction_id: params.transactionId,
    country: "CM",
    account_bank: params.gateway,
  }) as any;

  // 2. Confirm disbursement
  const confirmResult = await payunitClient.disbursement.confirmDisbursement({
    pay_token: disbursement.pay_token,
    deposit_message: "WasteMap CM collector payout",
    deposit_note: "Payment for completed pickup",
    notify_url: env.PAYUNIT_DISBURSEMENT_NOTIFY_URL,
  }) as any;

  return confirmResult;
};

// ─── Step D: Check disbursement status ───
export const getDisbursementStatus = async (transactionId: string) => {
  const result = await payunitClient.disbursement.getDisbursementStatus(
    transactionId
  ) as any;
  return result;
};