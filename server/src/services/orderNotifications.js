const text = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function orderSummary(order, customer) {
  const items = order.items.map((item) => `${item.qty} x ${item.name} (₹${item.unitPrice})`).join('\n');
  const address = order.address ? `${order.address.line1}, ${order.address.city} - ${order.address.pincode}` : 'Not provided';
  return `New GrocerAI order #${order.id.slice(-6)}\nCustomer: ${customer.name} (${customer.email})\nItems:\n${items}\nTotal: ₹${order.total}\nPayment: ${order.payment?.method || 'N/A'} (${order.payment?.status || 'N/A'})\nDelivery address: ${address}\nStatus: ${order.status}`;
}

async function sendEmail({ order, customer, config }) {
  const { resendApiKey, adminEmail, emailFrom } = config;
  if (!resendApiKey || !adminEmail || !emailFrom) return 'not-configured';
  const address = order.address ? `${order.address.line1}, ${order.address.city} - ${order.address.pincode}` : 'Not provided';
  const rows = order.items.map((i) => `<tr><td>${text(i.name)}</td><td>${i.qty}</td><td>₹${Number(i.unitPrice).toFixed(2)}</td></tr>`).join('');
  const html = `<h2>New GrocerAI order #${text(order.id.slice(-6))}</h2><p><b>Customer:</b> ${text(customer.name)} (${text(customer.email)})</p><table border="1" cellpadding="8" cellspacing="0"><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th></tr></thead><tbody>${rows}</tbody></table><p><b>Total:</b> ₹${Number(order.total).toFixed(2)}</p><p><b>Payment:</b> ${text(order.payment?.method || 'N/A')} (${text(order.payment?.status || 'N/A')})</p><p><b>Delivery address:</b> ${text(address)}</p><p><b>Status:</b> ${text(order.status)}</p>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: emailFrom, to: [adminEmail], subject: `New GrocerAI order #${order.id.slice(-6)}`, html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend email failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return 'sent';
}

async function sendWhatsApp({ order, customer, config }) {
  const { twilioAccountSid, twilioAuthToken, twilioWhatsAppFrom, adminWhatsApp } = config;
  if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppFrom || !adminWhatsApp) return 'not-configured';
  const body = new URLSearchParams({ To: adminWhatsApp, From: twilioWhatsAppFrom, Body: orderSummary(order, customer) });
  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body, signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Twilio WhatsApp failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  return 'sent';
}

export async function notifyAdminNewOrder({ order, customer, config = {} }) {
  const tasks = [ ['email', () => sendEmail({ order, customer, config })], ['WhatsApp', () => sendWhatsApp({ order, customer, config })] ];
  await Promise.all(tasks.map(async ([name, send]) => {
    try {
      const result = await send();
      if (result === 'sent') console.info(`[notifications] ${name} sent for order ${order.id}`);
      else console.info(`[notifications] ${name} not configured; skipped for order ${order.id}`);
    } catch (error) {
      console.error(`[notifications] ${name} failed for order ${order.id}: ${error.message}`);
    }
  }));
}
