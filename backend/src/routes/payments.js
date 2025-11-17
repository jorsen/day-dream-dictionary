const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { paymentLog, auditLog } = require('../middleware/logger');
const {
  getSupabase,
  getUserProfile,
  updateUserCredits,
  getUserSubscription
} = require('../config/supabase');
const {
  DYNAMIC_CREDIT_CONFIG,
  getUserLoyaltyTier,
  getUserSubscriptionMultiplier,
  calculateDynamicPricing,
  getTotalDynamicCredits,
  applyDynamicCredits
} = require('../config/dynamic-credits');

// Initialize Stripe with error handling
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe initialized successfully');
  } else {
    console.log('⚠️ STRIPE_SECRET_KEY not found, using mock implementation');
  }
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error.message);
}

// Base credit pack configurations (before dynamic pricing)
const BASE_CREDIT_PACKS = {
  'pack_10': {
    credits: 10,
    basePrice: 999, // $9.99 in cents
    name: 'Starter Pack',
    description: '10 credits for dream interpretations'
  },
  'pack_25': {
    credits: 25,
    basePrice: 1999, // $19.99 in cents
    name: 'Value Pack',
    description: '25 credits for dream interpretations'
  },
  'pack_60': {
    credits: 60,
    basePrice: 3999, // $39.99 in cents
    name: 'Premium Pack',
    description: '60 credits for dream interpretations'
  }
};

// Get dynamic credit packs for user
const getDynamicCreditPacks = async (userId) => {
  const packs = {};

  for (const [packId, pack] of Object.entries(BASE_CREDIT_PACKS)) {
    const dynamicPrice = await calculateDynamicPricing(userId, pack.basePrice, pack.credits);
    const subscriptionMultiplier = await getUserSubscriptionMultiplier(userId);
    const loyaltyTier = await getUserLoyaltyTier(userId);
    const loyaltyMultiplier = DYNAMIC_CREDIT_CONFIG.loyaltyTiers[loyaltyTier].multiplier;

    // Calculate effective credits (including multipliers)
    const effectiveCredits = Math.round(pack.credits * subscriptionMultiplier * loyaltyMultiplier);

    packs[packId] = {
      ...pack,
      price: dynamicPrice,
      originalPrice: pack.basePrice,
      effectiveCredits,
      discount: pack.basePrice > dynamicPrice,
      discountPercent: pack.basePrice > dynamicPrice
        ? Math.round(((pack.basePrice - dynamicPrice) / pack.basePrice) * 100)
        : 0,
      loyaltyTier,
      subscriptionMultiplier
    };
  }

  return packs;
};

// Create Stripe customer
const createOrGetStripeCustomer = async (userId, email) => {
  const supabase = getSupabase();
  
  // Check if customer already exists
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();
  
  if (subscription?.stripe_customer_id) {
    return subscription.stripe_customer_id;
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId
    }
  });
  
  // Store customer ID
  await supabase
    .from('subscriptions')
    .upsert([{
      user_id: userId,
      stripe_customer_id: customer.id,
      status: 'inactive',
      created_at: new Date().toISOString()
    }]);
  
  return customer.id;
};

// Create checkout session for subscription
router.post('/create-subscription-checkout', 
  authenticate,
  body('priceId').notEmpty(),
  body('successUrl').isURL(),
  body('cancelUrl').isURL(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { priceId, successUrl, cancelUrl } = req.body;
    
    try {
      // Get or create Stripe customer
      const customerId = await createOrGetStripeCustomer(userId, req.user.email);
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId
        },
        subscription_data: {
          metadata: {
            userId
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto'
      });
      
      // Track event
      await Event.trackEvent(userId, 'subscription_checkout_created', {
        priceId,
        sessionId: session.id
      });
      
      paymentLog('subscription_checkout_created', userId, {
        priceId,
        sessionId: session.id
      });
      
      res.json({
        sessionId: session.id,
        url: session.url
      });
      
    } catch (error) {
      paymentLog('subscription_checkout_error', userId, {
        error: error.message
      });
      next(error);
    }
  })
);

// Create checkout session for credit pack
router.post('/create-credits-checkout',
  authenticate,
  body('packId').isIn(Object.keys(BASE_CREDIT_PACKS)),
  body('successUrl').isURL(),
  body('cancelUrl').isURL(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { packId, successUrl, cancelUrl } = req.body;

    // Get dynamic credit packs for this user
    const dynamicPacks = await getDynamicCreditPacks(userId);
    const pack = dynamicPacks[packId];
    
    try {
      // Get or create Stripe customer
      const customerId = await createOrGetStripeCustomer(userId, req.user.email);
      
      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: pack.name,
              description: pack.description
            },
            unit_amount: pack.price
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
          packId,
          credits: pack.credits
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto'
      });
      
      // Track event
      await Event.trackEvent(userId, 'credits_checkout_created', {
        packId,
        credits: pack.credits,
        price: pack.price,
        sessionId: session.id
      });
      
      paymentLog('credits_checkout_created', userId, {
        packId,
        credits: pack.credits,
        sessionId: session.id
      });
      
      res.json({
        sessionId: session.id,
        url: session.url
      });
      
    } catch (error) {
      paymentLog('credits_checkout_error', userId, {
        error: error.message
      });
      next(error);
    }
  })
);

// Get subscription status
router.get('/subscription', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({
        hasSubscription: false,
        subscription: null
      });
    }
    
    // Get additional details from Stripe if active
    let stripeDetails = null;
    if (subscription.stripe_subscription_id && subscription.status === 'active') {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );
        
        stripeDetails = {
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          status: stripeSubscription.status
        };
      } catch (error) {
        console.error('Error fetching Stripe subscription:', error);
      }
    }
    
    res.json({
      hasSubscription: subscription.status === 'active',
      subscription: {
        ...subscription,
        stripeDetails
      }
    });
    
  } catch (error) {
    next(error);
  }
}));

// Cancel subscription
router.post('/cancel-subscription', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const subscription = await getUserSubscription(userId);
    
    if (!subscription || !subscription.stripe_subscription_id) {
      throw new AppError('No active subscription found', 404);
    }
    
    // Cancel subscription at period end
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: true }
    );
    
    // Update database
    const supabase = getSupabase();
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    // Track event
    await Event.trackEvent(userId, 'subscription_cancelled', {
      subscriptionId: subscription.stripe_subscription_id,
      plan: subscription.plan
    });
    
    paymentLog('subscription_cancelled', userId, {
      subscriptionId: subscription.stripe_subscription_id
    });
    
    auditLog('subscription_cancelled', userId, {
      subscriptionId: subscription.stripe_subscription_id
    });
    
    res.json({
      message: 'Subscription will be cancelled at the end of the current billing period',
      cancelAt: new Date(updatedSubscription.cancel_at * 1000)
    });
    
  } catch (error) {
    paymentLog('subscription_cancel_error', userId, {
      error: error.message
    });
    next(error);
  }
}));

// Resume cancelled subscription
router.post('/resume-subscription', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  try {
    const subscription = await getUserSubscription(userId);
    
    if (!subscription || !subscription.stripe_subscription_id) {
      throw new AppError('No subscription found', 404);
    }
    
    // Resume subscription
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      { cancel_at_period_end: false }
    );
    
    // Update database
    const supabase = getSupabase();
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    // Track event
    await Event.trackEvent(userId, 'subscription_resumed', {
      subscriptionId: subscription.stripe_subscription_id,
      plan: subscription.plan
    });
    
    paymentLog('subscription_resumed', userId, {
      subscriptionId: subscription.stripe_subscription_id
    });
    
    res.json({
      message: 'Subscription resumed successfully',
      subscription: updatedSubscription
    });
    
  } catch (error) {
    paymentLog('subscription_resume_error', userId, {
      error: error.message
    });
    next(error);
  }
}));

// Get payment history
router.get('/history', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 10, starting_after } = req.query;
  
  try {
    const supabase = getSupabase();
    
    // Get payment history from database
    let query = supabase
      .from('payments_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (starting_after) {
      query = query.lt('created_at', starting_after);
    }
    
    const { data: payments, error } = await query;
    
    if (error) throw error;
    
    res.json({
      payments,
      hasMore: payments.length === limit
    });
    
  } catch (error) {
    next(error);
  }
}));

// Get dynamic credit packs for user
router.get('/credit-packs', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const dynamicPacks = await getDynamicCreditPacks(userId);
    const totalDynamicCredits = await getTotalDynamicCredits(userId);

    res.json({
      packs: dynamicPacks,
      userInfo: {
        loyaltyTier: totalDynamicCredits.loyaltyTier,
        subscriptionMultiplier: totalDynamicCredits.subscriptionMultiplier,
        loyaltyMultiplier: totalDynamicCredits.loyaltyMultiplier,
        totalBonusCredits: totalDynamicCredits.totalBonus
      }
    });

  } catch (error) {
    next(error);
  }
}));

// Get credit balance with dynamic info
router.get('/credits', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const supabase = getSupabase();

    const { data: credits, error } = await supabase
      .from('credits')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Get dynamic credit information
    const totalDynamicCredits = await getTotalDynamicCredits(userId);

    res.json({
      balance: credits?.balance || 0,
      dynamicInfo: {
        loyaltyTier: totalDynamicCredits.loyaltyTier,
        subscriptionMultiplier: totalDynamicCredits.subscriptionMultiplier,
        loyaltyMultiplier: totalDynamicCredits.loyaltyMultiplier,
        availableBonusCredits: totalDynamicCredits.totalBonus
      }
    });

  } catch (error) {
    next(error);
  }
}));

// Update payment method
router.post('/update-payment-method', 
  authenticate,
  body('paymentMethodId').notEmpty(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { paymentMethodId } = req.body;
    
    try {
      // Get customer ID
      const customerId = await createOrGetStripeCustomer(userId, req.user.email);
      
      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      
      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
      
      // Track event
      await Event.trackEvent(userId, 'payment_method_updated', {
        paymentMethodId
      });
      
      paymentLog('payment_method_updated', userId, {
        paymentMethodId
      });
      
      res.json({
        message: 'Payment method updated successfully'
      });
      
    } catch (error) {
      paymentLog('payment_method_update_error', userId, {
        error: error.message
      });
      next(error);
    }
  })
);

// Get invoices
router.get('/invoices', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { limit = 10 } = req.query;
  
  try {
    // Get customer ID
    const supabase = getSupabase();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();
    
    if (!subscription?.stripe_customer_id) {
      return res.json({ invoices: [] });
    }
    
    // Get invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: subscription.stripe_customer_id,
      limit
    });
    
    res.json({
      invoices: invoices.data.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        date: new Date(invoice.created * 1000),
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url
      }))
    });
    
  } catch (error) {
    next(error);
  }
}));

// Apply promo code
router.post('/apply-promo',
  authenticate,
  body('code').notEmpty().trim(),
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const userId = req.user.id;
    const { code } = req.body;
    
    try {
      // Validate promo code with Stripe
      const promotionCodes = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1
      });
      
      if (promotionCodes.data.length === 0) {
        throw new AppError('Invalid or expired promo code', 400);
      }
      
      const promoCode = promotionCodes.data[0];
      
      // Track event
      await Event.trackEvent(userId, 'promo_code_used', {
        code,
        couponId: promoCode.coupon.id
      });
      
      res.json({
        message: 'Promo code applied successfully',
        discount: {
          percentOff: promoCode.coupon.percent_off,
          amountOff: promoCode.coupon.amount_off,
          currency: promoCode.coupon.currency
        }
      });
      
    } catch (error) {
      if (error.type === 'StripeInvalidRequestError') {
        throw new AppError('Invalid promo code', 400);
      }
      next(error);
    }
  })
);

// Purchase credits endpoint
router.post('/purchase-credits', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { packSize } = req.body;

  // Define credit packs
  const creditPacks = {
    small: { credits: 10, amount: 999 },
    medium: { credits: 30, amount: 1999 },
    large: { credits: 75, amount: 3999 }
  };

  if (!creditPacks[packSize]) {
    throw new AppError('Invalid credit pack', 400);
  }

  const pack = creditPacks[packSize];

  try {
    // Get current credits
    const currentCredits = await getUserCredits(userId);

    // Add credits to user account
    const newCredits = currentCredits + pack.credits;
    await updateUserCredits(userId, newCredits);

    // Record the purchase (optional - skip if Supabase not available)
    try {
      const { getSupabase } = require('../config/supabase');
      await getSupabase()
        .from('payments_history')
        .insert([{
          user_id: userId,
          type: 'credit_purchase',
          amount: pack.amount,
          credits: pack.credits,
          pack_size: packSize,
          created_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.log('Could not record purchase in database');
    }

    // Track event (optional - skip if MongoDB not available)
    try {
      const Event = require('../models/Event');
      await Event.trackEvent(userId, 'credits_purchased', {
        packSize,
        credits: pack.credits,
        amount: pack.amount
      });
    } catch (error) {
      console.log('Event tracking skipped');
    }

    res.json({
      message: `Successfully purchased ${pack.credits} credits`,
      creditsAdded: pack.credits,
      newTotal: newCredits
    });

  } catch (error) {
    next(error);
  }
}));

module.exports = router;
