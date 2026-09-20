/**
 * Endpoint Serverless: Webhook Criptográficamente Firmado de Stripe (Vercel)
 * OWASP A01 & A08: Integridad criptográfica para prevenir ataques de repetición o falsificación.
 */

// Desactivar el body-parser de Vercel para leer el raw buffer
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper para leer el stream en crudo
async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error('Configuración incompleta: Faltan variables de entorno de Stripe.');
    return res.status(500).send('Webhook unconfigured');
  }

  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // 🛡️ VERIFICACIÓN CRIPTOGRÁFICA DE LA FIRMA
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`⚠️ Error al verificar firma del Webhook: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Procesamiento seguro de eventos confirmados
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email;
      const planId = session.metadata?.planId;
      const transactionId = session.payment_intent || session.id;

      console.log(`✅ Pago verificado legítimamente para: ${customerEmail} (Plan: ${planId}, Transacción: ${transactionId})`);
      
      // Aquí registrarías la licencia en tu base de datos (ej. Supabase) o enviarías la clave por email
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`ℹ️ Suscripción cancelada: ${subscription.id}`);
      break;
    }

    default:
      console.log(`Evento ignorado: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}
