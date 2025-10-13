'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Dream {
  id: string;
  dream_text: string;
  interpretation: any;
  interpretation_type: string;
  ai_model: string;
  credits_used: number;
  is_favorite?: boolean;
  created_at: string;
  updated_at: string;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'recent'>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }

    loadDreams();
  }, [user, router]);

  const loadDreams = async () => {
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

      // Use your existing backend API to load dreams
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/test-dreams-history?page=1&limit=50&sortBy=created_at&order=desc`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDreams(data.dreams || []);
        setError('');
      } else {
        console.error('Error loading dreams:', response.status);
        setError(`Failed to load dream history: ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading dreams:', error);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-6xl mb-4">🔒</div>
          <p className="text-xl">Please sign in to view your history</p>
        </div>
      </div>
    );
  }

  const filteredDreams = dreams.filter(dream => {
    if (filter === 'recent') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return new Date(dream.created_at) > oneWeekAgo;
    }
    return true;
  });

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
            <h1 className="text-2xl font-bold text-white">Dream History</h1>
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="bg-white/20 border border-white/30 rounded-lg text-white px-3 py-2"
            >
              <option value="all">All Dreams</option>
              <option value="recent">Recent (7 days)</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-200 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-white">
            <div className="text-4xl mb-4">🔮</div>
            <p>Loading your dreams...</p>
          </div>
        ) : filteredDreams.length === 0 ? (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">📚</div>
            <p className="text-xl mb-4">No dreams found</p>
            <p className="text-purple-300">
              {filter === 'all'
                ? "You haven't interpreted any dreams yet. Go back and share your first dream!"
                : "No recent dreams found. Try interpreting a dream today!"}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Interpret a Dream
            </button>
          </div>
        ) : (
          <div className="grid gap-6">
            {filteredDreams.map((dream) => (
              <div key={dream.id} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <span className="text-sm text-purple-300">
                        {new Date(dream.created_at).toLocaleDateString()} at{' '}
                        {new Date(dream.created_at).toLocaleTimeString()}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        dream.interpretation_type === 'deep'
                          ? 'bg-purple-600/30 text-purple-200'
                          : 'bg-blue-600/30 text-blue-200'
                      }`}>
                        {dream.interpretation_type} analysis
                      </span>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 mb-4">
                      <h4 className="text-purple-200 mb-2">Your Dream:</h4>
                      <p className="text-white">{dream.dream_text}</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-lg font-semibold text-purple-200 mb-2">🎭 Themes</h4>
                    <div className="flex flex-wrap gap-2">
                      {dream.interpretation?.themes?.map((theme: string, index: number) => (
                        <span key={index} className="bg-purple-600/30 text-purple-200 px-3 py-1 rounded-full text-sm">
                          {theme}
                        </span>
                      )) || <span className="text-purple-300">No themes identified</span>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-purple-200 mb-2">🔍 Symbols</h4>
                    <div className="space-y-2">
                      {dream.interpretation?.symbols?.map((symbol: string, index: number) => (
                        <div key={index} className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
                          <div className="text-blue-200">{symbol}</div>
                        </div>
                      )) || <span className="text-purple-300">No symbols identified</span>}
                    </div>
                  </div>
                </div>

                {dream.interpretation?.guidance && (
                  <div className="mt-6">
                    <h4 className="text-lg font-semibold text-purple-200 mb-2">🌟 Guidance</h4>
                    <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3">
                      <div className="text-yellow-200">
                        {dream.interpretation.guidance}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-4 text-sm text-purple-300">
                  Credits used: {dream.credits_used} • AI Model: {dream.ai_model}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
