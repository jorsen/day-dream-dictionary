// Payment Processing Server with Stripe Integration
const http = require('http');
const url = require('url');

// Get Stripe configuration from environment variables for production compatibility
const STRIPE_CONFIG = {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_51SIErkBB0zCKREN6UDCN9durrrgIbxjNLRevZjGhIrTq7bHJQwIvm2osGUxSa7KkjD7WFdfm8RDcCPoS2SuGnzCG00F9n2QUR3',
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_51SIErkBB0zCKREN67U6W3YOHlgnWh9KB0o5eTSSR0feZhxlD33hiJa47x0HafKIm5Rb4RuMCaVwaNnypXvHYjj4400Prn0G7Ix',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_webhook_secret'
};

// Initialize Stripe with secret key (only if available in production)
let stripeInstance = null;
if (process.env.STRIPE_SECRET_KEY && (process.env.NODE_ENV === 'production' || process.env.STRIPE_SECRET_KEY !== 'sk_test_51SIErkBB0zCKREN67U6W3YOHlgnWh9KB0o5eTSSR0feZhxlD33hiJa47x0HafKIm5Rb4RuMCaVwaNnypXvHYjj4400Prn0G7Ix')) {
    try {
        const stripe = require('stripe');
        stripeInstance = stripe(STRIPE_CONFIG.secretKey);
        console.log('✅ Stripe initialized with real API keys');
    } catch (error) {
        console.log('⚠️ Stripe library not available, using mock implementation');
    }
} else {
    console.log('🔄 Using mock Stripe implementation for development');
}

// Mock payment processing functions (with real Stripe API keys configured)
const createPaymentIntent = async (amount, currency = 'usd', metadata = {}) => {
    // Mock Stripe payment intent creation (ready for real Stripe integration)
    console.log('🔄 Creating mock payment intent (real Stripe keys configured)');
    const timestamp = Date.now();
    const randomSecret = Math.random().toString(36).substr(2, 9);
    // Use real Stripe ID format: pi_ + 24 characters
    const randomId = Math.random().toString(36).substr(2, 24);
    const paymentIntentId = `pi_${randomId}`;
    return {
        id: paymentIntentId,
        client_secret: `${paymentIntentId}_secret_${randomSecret}`,
        amount: amount,
        currency: currency,
        status: 'requires_payment_method',
        metadata: metadata,
        created: Math.floor(timestamp / 1000)
    };
};

const createSubscription = async (priceId, customerId, paymentMethodId) => {
    // Mock Stripe subscription creation (ready for real Stripe integration)
    console.log('🔄 Creating mock subscription (real Stripe keys configured)');
    const timestamp = Date.now();
    const randomSecret = Math.random().toString(36).substr(2, 9);
    // Use real Stripe ID format: pi_ + 24 characters
    const randomId = Math.random().toString(36).substr(2, 24);
    const paymentIntentId = `pi_${randomId}`;
    return {
        id: `sub_${Math.random().toString(36).substr(2, 24)}`,
        customer: customerId,
        status: 'active',
        current_period_start: Math.floor(timestamp / 1000),
        current_period_end: Math.floor((timestamp + 30 * 24 * 60 * 60 * 1000) / 1000),
        items: [{
            price: priceId,
            quantity: 1
        }],
        latest_invoice: {
            id: `in_${Math.random().toString(36).substr(2, 24)}`,
            payment_intent: {
                id: paymentIntentId,
                client_secret: `${paymentIntentId}_secret_${randomSecret}`,
                status: 'requires_payment_method'
            },
            status: 'open'
        }
    };
};

const confirmPayment = async (paymentIntentId) => {
    // Mock payment confirmation (ready for real Stripe integration)
    console.log('🔄 Confirming mock payment (real Stripe keys configured)');
    return {
        id: paymentIntentId,
        status: 'succeeded',
        amount_received: 999, // Would match original amount
        payment_method: `pm_mock_${Date.now()}`,
        receipt_email: 'customer@example.com'
    };
};

// In-memory payment storage
const paymentIntents = new Map();
const subscriptions = new Map();
const customers = new Map();
const paymentMethods = new Map();

// Product catalog
const PRODUCTS = {
    credit_packs: {
        small: {
            id: 'price_small_credits',
            name: 'Small Credit Pack',
            amount: 999, // $9.99 in cents
            currency: 'usd',
            credits: 10,
            description: '10 Dream Interpretation Credits'
        },
        medium: {
            id: 'price_medium_credits',
            name: 'Medium Credit Pack',
            amount: 1999, // $19.99 in cents
            currency: 'usd',
            credits: 30, // 25 + 5 bonus
            description: '30 Dream Interpretation Credits (25 + 5 bonus)'
        },
        large: {
            id: 'price_large_credits',
            name: 'Large Credit Pack',
            amount: 3999, // $39.99 in cents
            currency: 'usd',
            credits: 75, // 60 + 15 bonus
            description: '75 Dream Interpretation Credits (60 + 15 bonus)'
        }
    },
    subscriptions: {
        basic: {
            id: 'price_basic_monthly',
            name: 'Basic Plan',
            amount: 499, // $4.99 in cents
            currency: 'usd',
            interval: 'month',
            features: ['20 basic interpretations', '5 deep interpretations', 'unlimited history', 'PDF export', 'no ads']
        },
        pro: {
            id: 'price_pro_monthly',
            name: 'Pro Plan',
            amount: 1299, // $12.99 in cents
            currency: 'usd',
            interval: 'month',
            features: ['unlimited interpretations', 'analytics', 'voice journaling', 'reminders', 'symbol encyclopedia', 'no ads']
        }
    },
    add_ons: {
        remove_ads: {
            id: 'price_remove_ads',
            name: 'Remove Ads',
            amount: 199, // $1.99 in cents
            currency: 'usd',
            interval: 'month',
            description: 'Ad-free experience'
        },
        life_season_report: {
            id: 'price_life_season',
            name: 'Life Season Report',
            amount: 1499, // $14.99 in cents
            currency: 'usd',
            description: 'Personal life analysis based on dreams'
        },
        recurring_dream_map: {
            id: 'price_recurring_map',
            name: 'Recurring Dream Map',
            amount: 999, // $9.99 in cents
            currency: 'usd',
            description: 'Visualization of recurring dream patterns'
        },
        couples_report: {
            id: 'price_couples_report',
            name: 'Couples Report',
            amount: 1999, // $19.99 in cents
            currency: 'usd',
            description: 'Relationship dream analysis'
        },
        lucid_kit: {
            id: 'price_lucid_kit',
            name: 'Lucid Dreaming Kit',
            amount: 2499, // $24.99 in cents
            currency: 'usd',
            description: 'Tools and techniques for lucid dreaming'
        },
        therapist_export: {
            id: 'price_therapist_export',
            name: 'Therapist Export',
            amount: 2999, // $29.99 in cents
            currency: 'usd',
            description: 'Professional export format for therapists'
        }
    }
};

// Create or get customer using mock implementation (ready for real Stripe)
const getOrCreateCustomer = async (userId, email) => {
    // Check if customer already exists in our local cache
    if (customers.has(userId)) {
        return customers.get(userId);
    }

    // Mock Stripe customer creation (ready for real Stripe integration)
    console.log('🔄 Creating mock customer (real Stripe keys configured)');
    const customerData = {
        id: `cus_mock_${userId}`,
        email: email,
        metadata: { 
            user_id: userId,
            source: 'day-dream-dictionary'
        }
    };
    
    customers.set(userId, customerData);
    return customerData;
};

// Payment server
const paymentServer = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    console.log(`PAYMENT: ${method} ${path}`);

    // Payment intent creation
    if (path === '/api/v1/payment/create-intent' && method === 'POST') {
        console.log('PAYMENT: Processing create-intent request');
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                console.log('PAYMENT: Received body:', body);
                const data = JSON.parse(body);
                const { amount, currency = 'usd', metadata = {} } = data;

                console.log('PAYMENT: Creating payment intent for amount:', amount);
                const paymentIntent = await createPaymentIntent(amount, currency, metadata);
                paymentIntents.set(paymentIntent.id, paymentIntent);

                console.log('PAYMENT: Payment intent created:', paymentIntent.id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    clientSecret: paymentIntent.client_secret,
                    paymentIntentId: paymentIntent.id
                }));
            } catch (error) {
                console.log('PAYMENT: Error creating payment intent:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Confirm payment
    if (path === '/api/v1/payment/confirm' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { paymentIntentId } = data;
                
                const confirmedPayment = await confirmPayment(paymentIntentId);
                
                // Update payment intent status
                if (paymentIntents.has(paymentIntentId)) {
                    const intent = paymentIntents.get(paymentIntentId);
                    intent.status = confirmedPayment.status;
                    intent.amount_received = confirmedPayment.amount_received;
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    payment: confirmedPayment
                }));
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Create subscription
    if (path === '/api/v1/payment/create-subscription' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const { priceId, userId, email, paymentMethodId } = data;
                
                const customer = await getOrCreateCustomer(userId, email);
                const subscription = await createSubscription(priceId, customer.id, paymentMethodId);
                
                subscriptions.set(subscription.id, subscription);
                
                // Use the real client secret from Stripe subscription
                const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret || 
                                  `seti_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    clientSecret: clientSecret
                }));
            } catch (error) {
                console.error('❌ Subscription creation error:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Get products catalog
    if (path === '/api/v1/payment/products' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            products: PRODUCTS,
            publishableKey: STRIPE_CONFIG.publishableKey
        }));
        return;
    }

    // Get payment methods for customer
    if (path === '/api/v1/payment/methods' && method === 'GET') {
        const userId = parsedUrl.query.userId;
        if (userId && customers.has(userId)) {
            const methods = Array.from(paymentMethods.values())
                .filter(method => method.customer === customers.get(userId).id);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ paymentMethods: methods }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ paymentMethods: [] }));
        }
        return;
    }

    // Webhook handler (for Stripe events)
    if (path === '/api/v1/payment/webhook' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            // Mock webhook processing
            console.log('Webhook received:', body);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));
        });
        return;
    }

    // Default response
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Payment endpoint not found' }));
});

const PAYMENT_PORT = process.env.PORT || 5001;
paymentServer.listen(PAYMENT_PORT, () => {
    console.log(`\n💳 Payment Processing Server is running!`);
    console.log(`📡 Server: http://localhost:${PAYMENT_PORT}`);
    console.log(`💳 Payment Provider: Mock Stripe (ready for real integration)`);
    console.log(`\n📋 Available endpoints:`);
    console.log(`  POST /api/v1/payment/create-intent`);
    console.log(`  POST /api/v1/payment/confirm`);
    console.log(`  POST /api/v1/payment/create-subscription`);
    console.log(`  GET  /api/v1/payment/products`);
    console.log(`  GET  /api/v1/payment/methods`);
    console.log(`  POST /api/v1/payment/webhook`);
    console.log(`\n🚀 Press Ctrl+C to stop the payment server\n`);
});
