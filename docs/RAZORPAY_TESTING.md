# Razorpay test payments

GrocerAI uses Razorpay Standard Checkout. The Key Secret is read only by the server from `server/.env`; it is never sent to the browser.

## Configure test keys

Add these entries to `server/.env` (keep your real values private):

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_test_key_secret
```

Restart the backend after changing `.env`:

```bash
npm start
```

The checkout page checks `/api/payments/razorpay/status`. If keys are valid, it displays online checkout alongside Cash on Delivery.

## Test the flow

1. Sign in as a shopper, add products to the cart, and go to Checkout.
2. Enter/select a delivery address and choose online payment.
3. Use Razorpay's test checkout. Test transactions do not deduct real money.
4. For card testing, use the test card details in the official Razorpay documentation, with any future expiry date and random CVV.
5. For UPI test mode, use `success@razorpay` for a simulated success or `failure@razorpay` for a simulated failure when the test checkout offers the UPI ID field.
6. Confirm the order appears in the shopper's Orders page and Admin Dashboard. The admin order row shows the payment method, status and payment ID.

Official docs:
- https://razorpay.com/docs/payments/server-integration/nodejs/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/

## Important

- Test keys simulate payments; no real funds are transferred.
- Do not commit `server/.env` or share the Key Secret.
- Do not mark an order paid based only on the browser callback. The server verifies the Razorpay signature and payment status before creating the paid order.
- Before going live, complete Razorpay's account/KYC activation, switch to Live Mode, generate Live API keys, and replace the test keys securely.
