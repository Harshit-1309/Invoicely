import React, { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useLinkedIn } from 'react-linkedin-login-oauth2';
import { getApiUrl } from '../config/api';

interface AuthViewProps {
  onLogin: (user: any) => void;
}

export function AuthView({ onLogin }: AuthViewProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        onLogin(data.user);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialVerification = async (provider: string, token: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/auth/social'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, token }),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        onLogin(data.user);
      } else {
        setError(data.error || `${provider} authentication failed`);
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = useGoogleLogin({
    onSuccess: (codeResponse) => handleSocialVerification('Google', codeResponse.access_token),
    onError: () => setError('Google Login Failed')
  });

  const { linkedInLogin } = useLinkedIn({
    clientId: import.meta.env.VITE_LINKEDIN_CLIENT_ID || 'placeholder',
    redirectUri: `${window.location.origin}/linkedin`,
    onSuccess: (code) => handleSocialVerification('LinkedIn', code),
    onError: (error) => setError(`LinkedIn Login Failed: ${error.errorMessage}`)
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest border border-border-low-contrast rounded-2xl shadow-[0px_4px_24px_rgba(0,0,0,0.05)] p-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-xl shadow-sm text-white">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface">Invoicely</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-background mb-2">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {isLogin ? 'Sign in to access your dashboard' : 'Get started with automated invoicing'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-error-container/50 border border-error-container rounded-lg flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-[20px]">error</span>
            <p className="font-body-sm text-body-sm text-on-error-container">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-1.5">Full Name</label>
              <input 
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline rounded-lg px-4 py-3 font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                placeholder="Alex Rivera"
              />
            </div>
          )}
          
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1.5">Email Address</label>
            <input 
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline rounded-lg px-4 py-3 font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="alex@example.com"
            />
          </div>

          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-1.5">Password</label>
            <input 
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline rounded-lg px-4 py-3 font-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-container text-white rounded-lg py-3 font-label-lg text-label-lg transition-colors active:scale-[0.98] duration-150 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <span className="w-1/5 border-b border-border-low-contrast lg:w-1/4"></span>
          <span className="text-xs text-center text-on-surface-variant uppercase tracking-widest">or continue with</span>
          <span className="w-1/5 border-b border-border-low-contrast lg:w-1/4"></span>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button 
            type="button"
            onClick={() => loginGoogle()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-surface-container-lowest border border-outline-variant hover:bg-surface-subtle text-on-surface rounded-lg py-2.5 font-label-md transition-colors active:scale-[0.98] duration-150 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google
          </button>
          
          <button 
            type="button"
            onClick={() => linkedInLogin()}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#0A66C2] hover:bg-[#004182] text-white rounded-lg py-2.5 font-label-md transition-colors active:scale-[0.98] duration-150 shadow-sm cursor-pointer border-none disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            LinkedIn
          </button>
        </div>

        <div className="mt-8 text-center border-t border-border-low-contrast pt-6">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-primary font-semibold hover:underline bg-transparent border-none cursor-pointer"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
