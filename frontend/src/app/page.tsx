'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AuthModal } from '@/components/AuthModal';

interface DreamInterpretation {
  themes: string[];
  symbols: string[];
  insights: string[];
  guidance: string;
  mood: string;
}

export default function Home() {
  const [dreamText, setDreamText] = useState('');
  const [interpretationType, setInterpretationType] = useState('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<DreamInterpretation | null>(null);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { user, profile, signOut } = useAuth();

  const interpretDream = async () => {
    if (!dreamText.trim()) {
      setError('Please describe your dream first');
      return;
    }

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // TODO: Replace with actual API call to backend
      // For now, simulate interpretation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock interpretation response
      const mockInterpretation: DreamInterpretation = {
        themes: ['Self-discovery', 'Personal growth', 'Freedom'],
        symbols: ['Flying', 'Ocean', 'Dolphins', 'Sunset'],
        insights: [
          'Flying often represents a sense of freedom and liberation',
          'Ocean symbolizes the subconscious mind and emotions',
          'Dolphins represent playfulness and social connection'
        ],
        guidance: 'This dream suggests you are entering a period of personal growth and emotional freedom. Embrace new opportunities and trust your intuition.',
        mood: 'Positive and Liberating'
      };

      setInterpretation(mockInterpretation);
    } catch (err) {
      setError('Failed to interpret dream');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🌙</span>
            <h1 className="text-2xl font-bold text-white">Day Dream Dictionary</h1>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <button
                  onClick={() => window.location.href = '/history'}
                  className="text-white hover:text-purple-300 transition-colors"
                >
                  History
                </button>
                <button
                  onClick={() => window.location.href = '/profile'}
                  className="text-white hover:text-purple-300 transition-colors"
                >
                  Profile
                </button>
                <div className="text-white">Welcome, {profile?.display_name || user.email?.split('@')[0]}</div>
                <button
                  onClick={signOut}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Unlock the Secrets of Your Dreams
          </h2>
          <p className="text-xl text-purple-200 mb-8 max-w-2xl mx-auto">
            Discover the hidden meanings behind your dreams with AI-powered interpretation
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Dream Input */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-4">Share Your Dream</h3>

            <div className="mb-4">
              <label className="block text-purple-200 mb-2">Describe your dream in detail</label>
              <textarea
                value={dreamText}
                onChange={(e) => setDreamText(e.target.value)}
                placeholder="I was flying over a beautiful ocean with dolphins jumping alongside me. The sun was setting and everything was golden..."
                className="w-full h-40 p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>

            <div className="mb-6">
              <label className="block text-purple-200 mb-2">Interpretation Type</label>
              <select
                value={interpretationType}
                onChange={(e) => setInterpretationType(e.target.value)}
                className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="basic">Basic Analysis (1 credit)</option>
                <option value="deep">Deep Analysis (3 credits)</option>
              </select>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <button
              onClick={interpretDream}
              disabled={isLoading || !dreamText.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105"
            >
              {isLoading ? 'Interpreting...' : '✨ Interpret My Dream'}
            </button>
          </div>

          {/* Results */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-2xl font-semibold text-white mb-4">Interpretation</h3>

            {!interpretation ? (
              <div className="text-center text-purple-300 py-12">
                <div className="text-6xl mb-4">🔮</div>
                <p>Your dream interpretation will appear here</p>
                <p className="text-sm mt-2 opacity-75">Share your dream to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Themes */}
                <div>
                  <h4 className="text-lg font-semibold text-purple-200 mb-2">🎭 Main Themes</h4>
                  <div className="flex flex-wrap gap-2">
                    {interpretation.themes.map((theme, index) => (
                      <span key={index} className="bg-purple-600/30 text-purple-200 px-3 py-1 rounded-full text-sm">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Symbols */}
                <div>
                  <h4 className="text-lg font-semibold text-purple-200 mb-2">🔍 Key Symbols</h4>
                  <div className="space-y-2">
                    {interpretation.symbols.map((symbol, index) => (
                      <div key={index} className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3">
                        <div className="text-blue-200">{symbol}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insights */}
                <div>
                  <h4 className="text-lg font-semibold text-purple-200 mb-2">💡 Insights</h4>
                  <div className="space-y-2">
                    {interpretation.insights.map((insight, index) => (
                      <div key={index} className="bg-green-600/20 border border-green-500/30 rounded-lg p-3">
                        <div className="text-green-200">{insight}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Guidance */}
                <div>
                  <h4 className="text-lg font-semibold text-purple-200 mb-2">🌟 Guidance</h4>
                  <div className="bg-yellow-600/20 border border-yellow-500/30 rounded-lg p-3">
                    <div className="text-yellow-200">{interpretation.guidance}</div>
                  </div>
                </div>

                {/* Mood */}
                <div className="text-center">
                  <div className="text-sm text-purple-300">Overall Mood</div>
                  <div className="text-2xl font-semibold text-white">{interpretation.mood}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Authentication Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
