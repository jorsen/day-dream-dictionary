const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { getSupabase, updateUserCredits } = require('../config/supabase');
const { paymentLog, auditLog } = require('../middleware/logger');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  const supabase = getSupabase();
  
  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        
        if (session.mode === 'subscription') {
          // Handle subscription creation
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          
          // Determine plan based on price ID
          let plan = 'basic';
          if (subscription.items.data[0].price.id === process.env.STRIPE_PRO_PRICE_ID) {
            plan = 'pro';
          }
          
          // Update database
          await supabase
            .from('subscriptions')
            .upsert([{
              user_id: userId,
              stripe_customer_id: session.customer,
              stripe_subscription_id: subscription.id,
              plan,
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString()
            }]);
          
          // Track event
          await Event.trackEvent(userId, 'subscription_created', {
            plan,
            subscriptionId: subscription.id,
            amount: session.amount_total
          });
          
          paymentLog('subscription_created', userId, {
            plan,
            subscriptionId: subscription.id
          });
          
        } else if (session.mode === 'payment') {
          // Handle credit pack purchase
          const credits = parseInt(session.metadata.credits);
          
          // Add credits to user
          await updateUserCredits(userId, credits, 'add');
          
          // Record payment
          await supabase
            .from('payments_history')
            .insert([{
              user_id: userId,
              amount: session.amount_total,
              currency: session.currency,
              status: 'succeeded',
              type: 'credits',
              provider_charge_id: session.payment_intent,
              metadata: {
                credits,
                packId: session.metadata.packId
              },
              created_at: new Date().toISOString()
            }]);
          
          // Track event
          await Event.trackEvent(userId, 'credits_purchased', {
            credits,
            amount: session.amount_total,
            packId: session.metadata.packId
          });
          
          paymentLog('credits_purchased', userId, {
            credits,
            amount: session.amount_total
          });
        }
        
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata.userId;
        
        // Determine plan
        let plan = 'basic';
        if (subscription.items.data[0].price.id === process.env.STRIPE_PRO_PRICE_ID) {
          plan = 'pro';
        }
        
        // Update subscription in database
        await supabase
          .from('subscriptions')
          .update({
            plan,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        // Track event
        await Event.trackEvent(userId, 'subscription_updated', {
          plan,
          status: subscription.status,
          subscriptionId: subscription.id
        });
        
        paymentLog('subscription_updated', userId, {
          plan,
          status: subscription.status
        });
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata.userId;
        
        // Update subscription status
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('stripe_subscription_id', subscription.id);
        
        // Track event
        await Event.trackEvent(userId, 'subscription_cancelled', {
          subscriptionId: subscription.id
        });
        
        paymentLog('subscription_cancelled', userId, {
          subscriptionId: subscription.id
        });
        
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        
        // Skip if this is the first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') {
          break;
        }
        
        // Get user ID from customer
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', invoice.customer)
          .single();
        
        if (subscription) {
          // Record payment
          await supabase
            .from('payments_history')
            .insert([{
              user_id: subscription.user_id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
              status: 'succeeded',
              type: 'subscription',
              provider_charge_id: invoice.charge,
              invoice_id: invoice.id,
              created_at: new Date().toISOString()
            }]);
          
          // Track event
          await Event.trackEvent(subscription.user_id, 'subscription_renewed', {
            amount: invoice.amount_paid,
            invoiceId: invoice.id
          });
          
          paymentLog('subscription_renewed', subscription.user_id, {
            amount: invoice.amount_paid
          });
        }
        
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Get user ID from customer
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', invoice.customer)
          .single();
        
        if (subscription) {
          // Record failed payment
          await supabase
            .from('payments_history')
            .insert([{
              user_id: subscription.user_id,
              amount: invoice.amount_due,
              currency: invoice.currency,
              status: 'failed',
              type: 'subscription',
              invoice_id: invoice.id,
              metadata: {
                attemptCount: invoice.attempt_count,
                nextPaymentAttempt: invoice.next_payment_attempt
              },
              created_at: new Date().toISOString()
            }]);
          
          // Track event
          await Event.trackEvent(subscription.user_id, 'payment_failed', {
            amount: invoice.amount_due,
            invoiceId: invoice.id,
            attemptCount: invoice.attempt_count
          });
          
          paymentLog('payment_failed', subscription.user_id, {
            amount: invoice.amount_due,
            attemptCount: invoice.attempt_count
          });
          
          // TODO: Send email notification about failed payment
        }
        
        break;
      }
      
      case 'charge.refunded': {
        const charge = event.data.object;
        
        // Get payment record
        const { data: payment } = await supabase
          .from('payments_history')
          .select('user_id, metadata')
          .eq('provider_charge_id', charge.id)
          .single();
        
        if (payment) {
          // Record refund
          await supabase
            .from('payments_history')
            .insert([{
              user_id: payment.user_id,
              amount: -charge.amount_refunded,
              currency: charge.currency,
              status: 'refunded',
              type: 'refund',
              provider_charge_id: charge.id,
              metadata: {
                originalChargeId: charge.id,
                refundId: charge.refunds.data[0].id,
                reason: charge.refunds.data[0].reason
              },
              created_at: new Date().toISOString()
            }]);
          
          // If this was a credit purchase, deduct credits
          if (payment.metadata?.credits) {
            await updateUserCredits(payment.user_id, payment.metadata.credits, 'subtract');
          }
          
          // Track event
          await Event.trackEvent(payment.user_id, 'refund_processed', {
            amount: charge.amount_refunded,
            chargeId: charge.id
          });
          
          paymentLog('refund_processed', payment.user_id, {
            amount: charge.amount_refunded
          });
          
          auditLog('refund_processed', payment.user_id, {
            amount: charge.amount_refunded,
            chargeId: charge.id
          });
        }
        
        break;
      }
      
      case 'customer.updated': {
        const customer = event.data.object;
        
        // Update customer email if changed
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customer.id)
          .single();
        
        if (subscription) {
          // You might want to update user email in Supabase Auth
          // This depends on your business logic
          console.log(`Customer ${customer.id} updated for user ${subscription.user_id}`);
        }
        
        break;
      }
      
      case 'payment_method.attached': {
        const paymentMethod = event.data.object;
        
        // Log payment method attachment
        console.log(`Payment method ${paymentMethod.id} attached to customer ${paymentMethod.customer}`);
        
        break;
      }
      
      case 'payment_method.detached': {
        const paymentMethod = event.data.object;
        
        // Log payment method detachment
        console.log(`Payment method ${paymentMethod.id} detached`);
        
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Log the error but still return 200 to prevent retries
    paymentLog('webhook_error', 'system', {
      eventType: event.type,
      error: error.message
    });
    
    res.json({ received: true, error: error.message });
  }
});

// Health check for webhook endpoint
router.get('/stripe/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Stripe webhook endpoint is ready'
  });
});

module.exports = router;