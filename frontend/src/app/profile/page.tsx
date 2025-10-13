'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  emailVerified?: boolean;
  locale?: string;
  credits?: number;
}

interface DreamStats {
  totalDreams: number;
  interpretations: number;
  thisMonth: number;
  creditsUsed: number;
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<DreamStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    loadProfileData();
  }, [user, router]);

  const loadProfileData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get access token from localStorage (set by your existing auth system)
      const accessToken = localStorage.getItem('accessToken');

      if (!accessToken) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      // Load user profile from your existing backend
      const profileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData.profile);
      }

      // Load dream statistics from your existing backend
      const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/dreams/stats/summary`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats || {
          totalDreams: 0,
          interpretations: 0,
          thisMonth: 0,
          creditsUsed: 0
        });
      }

    } catch (error) {
      console.error('Error loading profile data:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    // Clear localStorage tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentUser');

    await signOut();
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl">Please sign in to view your profile</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-4xl mb-4">🔮</div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => router.push('/')}
              className="text-white hover:text-purple-300 mr-4"
            >
              ← Back
            </button>
            <span className="text-2xl">🌙</span>
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
          </div>

          <button
            onClick={handleSignOut}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 mb-6">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Profile Information */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <span className="mr-3">👤</span> Profile Information
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-purple-200">User ID:</span>
                <span className="text-white font-mono text-sm">{profile?.id || 'Loading...'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Email:</span>
                <span className="text-white">{user?.email || profile?.email}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Display Name:</span>
                <span className="text-white">{profile?.displayName || 'Not set'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Role:</span>
                <span className="text-white capitalize">{profile?.role || 'user'}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Email Verified:</span>
                <span className="text-white">
                  {profile?.emailVerified ? '✅ Verified' : '❌ Not verified'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Language:</span>
                <span className="text-white">{profile?.locale || 'en'}</span>
              </div>
            </div>
          </div>

          {/* Subscription & Credits */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <span className="mr-3">💎</span> Subscription Status
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-purple-200">Plan:</span>
                <span className="text-white">
                  <span className="px-3 py-1 bg-green-600/30 text-green-200 rounded-full text-sm">
                    Free
                  </span>
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Credits:</span>
                <span className="text-white font-bold text-xl">
                  {profile?.credits || 5}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-purple-200">Monthly Limit:</span>
                <span className="text-white">5 basic / 3 deep</span>
              </div>
            </div>

            <button
              className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
              onClick={() => alert('🚀 Pro features coming soon!')}
            >
              Upgrade to Pro
            </button>
          </div>

          {/* Dream Statistics */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <span className="mr-3">📊</span> Dream Statistics
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats?.totalDreams || 0}</div>
                <div className="text-purple-200 text-sm">Total Dreams</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats?.interpretations || 0}</div>
                <div className="text-purple-200 text-sm">Interpretations</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats?.thisMonth || 0}</div>
                <div className="text-purple-200 text-sm">This Month</div>
              </div>

              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{stats?.creditsUsed || 0}</div>
                <div className="text-purple-200 text-sm">Credits Used</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <span className="mr-3">⚡</span> Quick Actions
            </h3>

            <div className="space-y-4">
              <button
                onClick={() => router.push('/')}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
              >
                ✨ Interpret a Dream
              </button>

              <button
                onClick={() => router.push('/history')}
                className="w-full bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-6 rounded-lg border border-white/30 transition-all"
              >
                📚 View Dream History
              </button>

              <button
                onClick={() => window.open('http://localhost:5000/profile-dashboard.html', '_blank')}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
              >
                🖥️  Open Full Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
