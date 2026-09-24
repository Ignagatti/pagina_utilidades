export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const { STRIPE_SECRET_KEY, APP_URL, STRIPE_PRICE_LIFETIME, STRIPE_PRICE_MONTHLY } = process.env;

  if (!STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error: 'Configuración pendiente: STRIPE_SECRET_KEY no está definida en las variables de entorno.'
    });
  }

  const PLANS_CATALOG = {
    lifetime: {
      priceId: STRIPE_PRICE_LIFETIME,
      mode: 'payment'
    },
    monthly: {
      priceId: STRIPE_PRICE_MONTHLY,
      mode: 'subscription'
    }
  };

  try {
    const { planId } = req.body || {};
    const plan = PLANS_CATALOG[planId];

    if (!plan || !plan.priceId) {
      return res.status(400).json({ error: 'Plan seleccionado no válido o no configurado.' });
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: plan.mode,
      success_url: `${APP_URL || 'https://quicktools.vercel.app'}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL || 'https://quicktools.vercel.app'}/?payment=canceled`,
      metadata: {
        planId: planId,
        createdAt: new Date().toISOString()
      },
    });

    return res.status(200).json({
      sessionId: session.id,
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error('[Stripe Checkout Error]:', error.message);
    return res.status(500).json({ error: 'Error al procesar la sesión de pago.' });
  }
}
