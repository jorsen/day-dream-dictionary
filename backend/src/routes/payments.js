const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { paymentLog, auditLog } = require('../middleware/logger');
const { User, Payment, Event } = require('../models');
const { logger } = require('../config/mongodb');

// Initialize Stripe with error handling
let stripe = null;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    logger.info('✅ Stripe initialized successfully');
  } else {
    logger.warn('⚠️ STRIPE_SECRET_KEY not found, using mock implementation');
  }
} catch (error) {
  logger.error('❌ Failed to initialize Stripe:', error.message);
}

// Base credit pack configurations
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
  const user = await User.findById(userId);
  
  // Calculate multipliers based on subscription
  const subscriptionMultiplier = user?.subscription?.plan === 'pro' ? 1.5 : 
                                 user?.subscription?.plan === 'basic' ? 1.25 : 1;

  for (const [packId, pack] of Object.entries(BASE_CREDIT_PACKS)) {
    const effectiveCredits = Math.round(pack.credits * subscriptionMultiplier);

    packs[packId] = {
      ...pack,
      price: pack.basePrice,
      originalPrice: pack.basePrice,
      effectiveCredits,
      discount: false,
      discountPercent: 0,
      subscriptionMultiplier
    };
  }

  return packs;
};

// Create or get Stripe customer
const createOrGetStripeCustomer = async (userId, email) => {
  const user = await User.findById(userId);
  
  if (user?.subscription?.stripeCustomerId) {
    return user.subscription.stripeCustomerId;
  }
  
  if (!stripe) {
    throw new AppError('Payment processing not available', 503);
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId: userId.toString()
    }
  });
  
  // Store customer ID
  await User.findByIdAndUpdate(userId, {
    'subscription.stripeCustomerId': customer.id
  });
  
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
    
    if (!stripe) {
      throw new AppError('Payment processing not available', 503);
    }
    
    const userId = req.user.id;
    const { priceId, successUrl, cancelUrl } = req.body;
    
    try {
      const customerId = await createOrGetStripeCustomer(userId, req.user.email);
      
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
          userId: userId.toString()
        },
        subscription_data: {
          metadata: {
            userId: userId.toString()
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto'
      });
      
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

    if (!stripe) {
      throw new AppError('Payment processing not available', 503);
    }

    const userId = req.user.id;
    const { packId, successUrl, cancelUrl } = req.body;

    const dynamicPacks = await getDynamicCreditPacks(userId);
    const pack = dynamicPacks[packId];
    
    try {
      const customerId = await createOrGetStripeCustomer(userId, req.user.email);
      
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
          userId: userId.toString(),
          packId,
          credits: pack.credits.toString()
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto'
      });
      
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
    const user = await User.findById(userId);
    
    if (!user || !user.subscription || user.subscription.plan === 'free') {
      return res.json({
        hasSubscription: false,
        subscription: null
      });
    }
    
    let stripeDetails = null;
    if (user.subscription.stripeSubscriptionId && user.subscription.status === 'active' && stripe) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          user.subscription.stripeSubscriptionId
        );
        
        stripeDetails = {
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          status: stripeSubscription.status
        };
      } catch (error) {
        logger.error('Error fetching Stripe subscription:', error);
      }
    }
    
    res.json({
      hasSubscription: user.subscription.status === 'active',
      subscription: {
        plan: user.subscription.plan,
        status: user.subscription.status,
        currentPeriodStart: user.subscription.currentPeriodStart,
        currentPeriodEnd: user.subscription.currentPeriodEnd,
        cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
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
    const user = await User.findById(userId);
    
    if (!user || !user.subscription?.stripeSubscriptionId) {
      throw new AppError('No active subscription found', 404);
    }
    
    if (!stripe) {
      throw new AppError('Payment processing not available', 503);
    }
    
    const updatedSubscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      { cancel_at_period_end: true }
    );
    
    await User.findByIdAndUpdate(userId, {
      'subscription.cancelAtPeriodEnd': true
    });
    
    await Event.trackEvent(userId, 'subscription_cancelled', {
      subscriptionId: user.subscription.stripeSubscriptionId,
      plan: user.subscription.plan
    });
    
    paymentLog('subscription_cancelled', userId, {
      subscriptionId: user.subscription.stripeSubscriptionId
    });
    
    auditLog('subscription_cancelled', userId, {
      subscriptionId: user.subscription.stripeSubscriptionId
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
    const user = await User.findById(userId);
    
    if (!user || !user.subscription?.stripeSubscriptionId) {
      throw new AppError('No subscription found', 404);
    }
    
    if (!stripe) {
      throw new AppError('Payment processing not available', 503);
    }
    
    const updatedSubscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      { cancel_at_period_end: false }
    );
    
    await User.findByIdAndUpdate(userId, {
      'subscription.cancelAtPeriodEnd': false
    });
    
    await Event.trackEvent(userId, 'subscription_resumed', {
      subscriptionId: user.subscription.stripeSubscriptionId,
      plan: user.subscription.plan
    });
    
    paymentLog('subscription_resumed', userId, {
      subscriptionId: user.subscription.stripeSubscriptionId
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
  const { limit = 10, page = 1 } = req.query;
  
  try {
    const result = await Payment.getUserPaymentHistory(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      payments: result.payments,
      hasMore: result.currentPage < result.totalPages,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages
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
    const user = await User.findById(userId);
    
    const subscriptionMultiplier = user?.subscription?.plan === 'pro' ? 1.5 : 
                                   user?.subscription?.plan === 'basic' ? 1.25 : 1;

    res.json({
      packs: dynamicPacks,
      userInfo: {
        subscriptionPlan: user?.subscription?.plan || 'free',
        subscriptionMultiplier
      }
    });

  } catch (error) {
    next(error);
  }
}));

// Get credit balance
router.get('/credits', authenticate, catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      balance: user.credits || 0,
      lifetimeCreditsEarned: user.lifetimeCreditsEarned || 0,
      subscriptionPlan: user.subscription?.plan || 'free'
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
    
    if (!stripe) {
      throw new AppError('Payment processing not available', 503);
    }
    
    const userId = req.user.id;
    const { paymentMethodId } = req.body;
    
    try {
      const customerId = await createOrGetStripeCustomer(userId, req.user.email);
      
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
      
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
      
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
    const user = await User.findById(userId);
    
    if (!user?.subscription?.stripeCustomerId || !stripe) {
      return res.json({ invoices: [] });
    }
    
    const invoices = await stripe.invoices.list({
      customer: user.subscription.stripeCustomerId,
      limit: parseInt(limit)
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
    
    if (!stripe) {
      throw new AppError('Payment processing not available', 503);
    }
    
    const userId = req.user.id;
    const { code } = req.body;
    
    try {
      const promotionCodes = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1
      });
      
      if (promotionCodes.data.length === 0) {
        throw new AppError('Invalid or expired promo code', 400);
      }
      
      const promoCode = promotionCodes.data[0];
      
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
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Add credits
    const newCredits = (user.credits || 0) + pack.credits;
    user.credits = newCredits;
    user.lifetimeCreditsEarned = (user.lifetimeCreditsEarned || 0) + pack.credits;
    await user.save();

    // Record the purchase
    await Payment.create({
      userId,
      type: 'credit_purchase',
      amount: pack.amount,
      currency: 'usd',
      status: 'succeeded',
      creditsPurchased: pack.credits,
      metadata: { packSize }
    });

    await Event.trackEvent(userId, 'credits_purchased', {
      packSize,
      credits: pack.credits,
      amount: pack.amount
    });

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
