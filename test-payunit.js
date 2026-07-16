// test-payunit.js
require('dotenv').config();
const { PayunitClient } = require('@payunit/nodejs-sdk');

const client = new PayunitClient({
  baseURL: 'https://gateway.payunit.net',
  apiKey: process.env.PAYUNIT_API_KEY,
  apiUsername: process.env.PAYUNIT_API_USER,
  apiPassword: process.env.PAYUNIT_API_PASSWORD,
  mode: process.env.PAYUNIT_MODE || 'test',
  timeout: 30000, // Increase timeout for testing
});

async function test() {
  try {
    console.log('Testing PayUnit connection...');
    const result = await client.collections.initiateAndMakePaymentMobileMoney({
      total_amount: 100,
      currency: 'XAF',
      transaction_id: `TEST_${Date.now()}`,
      gateway: 'CM_MTNMOMO',
      phone_number: '671234567',
      return_url: 'https://example.com/return',
      notify_url: 'https://example.com/webhook',
      payment_country: 'CM',
      redirect_on_failed: 'yes',
    });
    console.log(' Success:', result);
  } catch (error) {
    console.error(' Failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

test();