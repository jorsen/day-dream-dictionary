const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  displayName: {
    type: String,
    trim: true,
    default: function() {
      return this.email ? this.email.split('@')[0] : 'User';
    }
  },
  locale: {
    type: String,
    enum: ['en', 'es'],
    default: 'en'
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: false },
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    dreamPrivacy: { type: String, enum: ['private', 'anonymous', 'public'], default: 'private' },
    dreamStorage: { type: Boolean, default: true }
  },
  credits: {
    type: Number,
    default: 5 // Free tier starts with 5 credits
  },
  lifetimeCreditsEarned: {
    type: Number,
    default: 5
  },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'pro'], default: 'free' },
    status: { type: String, enum: ['active', 'inactive', 'cancelled', 'past_due'], default: 'active' },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false }
  },
  lastLoginAt: Date,
  lastActivityAt: Date,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'subscription.stripeCustomerId': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to return safe user object (without password)
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isDeleted: false });
};

// Static method to update credits
userSchema.statics.updateCredits = async function(userId, amount, operation = 'add') {
  const user = await this.findById(userId);
  if (!user) throw new Error('User not found');
  
  if (operation === 'add') {
    user.credits += amount;
    user.lifetimeCreditsEarned += amount;
  } else {
    user.credits = Math.max(0, user.credits - amount);
  }
  
  await user.save();
  return user.credits;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
