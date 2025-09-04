'use client';

import { useState, useEffect } from 'react';
import { Coins, Star, TrendingUp, Crown } from 'lucide-react';

interface CreditInfo {
  balance: number;
  dynamicInfo?: {
    loyaltyTier: string;
    subscriptionMultiplier: number;
    loyaltyMultiplier: number;
    availableBonusCredits: number;
  };
}

interface CreditDisplayProps {
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
}

export default function CreditDisplay({
  className = '',
  showDetails = false,
  compact = false
}: CreditDisplayProps) {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCreditInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/payments/credits', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCreditInfo(data);
        setError(null);
      } else {
        setError('Failed to load credit information');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditInfo();

    // Refresh credit info every 30 seconds
    const interval = setInterval(fetchCreditInfo, 30000);

    return () => clearInterval(interval);
  }, []);

  const getTierIcon = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return <Crown className="w-4 h-4 text-purple-500" />;
      case 'gold':
        return <Star className="w-4 h-4 text-yellow-500" />;
      case 'silver':
        return <TrendingUp className="w-4 h-4 text-gray-400" />;
      default:
        return <Coins className="w-4 h-4 text-orange-500" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'platinum':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'gold':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'silver':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  if (error || !creditInfo) {
    return (
      <div className={`flex items-center space-x-2 text-red-500 ${className}`}>
        <Coins className="w-4 h-4" />
        <span className="text-sm">Credits unavailable</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <Coins className="w-4 h-4 text-yellow-500" />
        <span className="font-semibold text-sm">{creditInfo.balance}</span>
        {creditInfo.dynamicInfo && (
          <div className="flex items-center space-x-1">
            {getTierIcon(creditInfo.dynamicInfo.loyaltyTier)}
            <span className="text-xs text-gray-500">
              {creditInfo.dynamicInfo.loyaltyTier}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-yellow-50 rounded-full">
            <Coins className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Credits Balance</h3>
            <p className="text-2xl font-bold text-gray-900">{creditInfo.balance}</p>
          </div>
        </div>

        {creditInfo.dynamicInfo && (
          <div className="flex items-center space-x-2">
            {getTierIcon(creditInfo.dynamicInfo.loyaltyTier)}
            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getTierColor(creditInfo.dynamicInfo.loyaltyTier)}`}>
              {creditInfo.dynamicInfo.loyaltyTier}
            </span>
          </div>
        )}
      </div>

      {showDetails && creditInfo.dynamicInfo && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Subscription Multiplier</span>
              <p className="font-medium">{creditInfo.dynamicInfo.subscriptionMultiplier}x</p>
            </div>
            <div>
              <span className="text-gray-500">Loyalty Multiplier</span>
              <p className="font-medium">{creditInfo.dynamicInfo.loyaltyMultiplier}x</p>
            </div>
            <div>
              <span className="text-gray-500">Available Bonuses</span>
              <p className="font-medium text-green-600">+{creditInfo.dynamicInfo.availableBonusCredits}</p>
            </div>
            <div>
              <span className="text-gray-500">Effective Rate</span>
              <p className="font-medium">
                {(creditInfo.dynamicInfo.subscriptionMultiplier * creditInfo.dynamicInfo.loyaltyMultiplier).toFixed(2)}x
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex space-x-2">
        <button
          onClick={fetchCreditInfo}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Refresh
        </button>
        <button
          onClick={() => window.location.href = '/payments'}
          className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Buy Credits
        </button>
      </div>
    </div>
  );
}
