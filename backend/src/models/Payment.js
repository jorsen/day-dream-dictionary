const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stripePaymentIntentId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripeInvoiceId: {
    type: String,
    sparse: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  type: {
    type: String,
    enum: ['subscription', 'one_time', 'credit_purchase', 'refund'],
    required: true
  },
  description: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // For subscription payments
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'pro']
  },
  billingPeriod: {
    start: Date,
    end: Date
  },
  // For credit purchases
  creditsPurchased: Number,
  // Refund info
  refundedAt: Date,
  refundReason: String,
  refundAmount: Number
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });

// Static method to get user payment history
paymentSchema.statics.getUserPaymentHistory = async function(userId, options = {}) {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const [payments, totalCount] = await Promise.all([
    this.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments({ userId })
  ]);

  return {
    payments,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
};

// Static method to calculate total revenue for a user
paymentSchema.statics.getUserTotalSpent = async function(userId) {
  const result = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'succeeded' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return result[0]?.total || 0;
};

// Static method to create subscription payment
paymentSchema.statics.createSubscriptionPayment = async function(userId, data) {
  return this.create({
    userId,
    type: 'subscription',
    ...data
  });
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
