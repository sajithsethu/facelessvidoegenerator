import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { Award, X } from 'lucide-react';

const FREE_LIMITS = {
  image: 5,
  video: 2,
  audio: 3,
  facelessVideo: 1,
};

interface Usage {
  image: number;
  video: number;
  audio: number;
  facelessVideo: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  usage: Usage;
  credits: number;
  login: () => void;
  logout: () => void;
  checkLimit: (type: keyof Usage) => boolean;
  incrementUsage: (type: keyof Usage) => void;
  showLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usage, setUsage] = useState<Usage>({ image: 0, video: 0, audio: 0, facelessVideo: 0 });
  const [credits, setCredits] = useState(100); // Mock credits for logged-in user
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    try {
      const storedUsage = localStorage.getItem('usageLimits');
      if (storedUsage) {
        const parsedUsage = JSON.parse(storedUsage);
        setUsage(prev => ({...prev, ...parsedUsage}));
      }
    } catch (e) {
      console.error("Failed to parse usage limits from localStorage", e);
      localStorage.removeItem('usageLimits');
    }
  }, []);

  const login = useCallback(() => {
    setIsAuthenticated(true);
    setIsModalOpen(false);
    // Logged-in users have credits, not free limits
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    // For this simulation, we reset usage on logout.
    localStorage.removeItem('usageLimits');
    setUsage({ image: 0, video: 0, audio: 0, facelessVideo: 0 });
  }, []);

  const incrementUsage = useCallback((type: keyof Usage) => {
    if (isAuthenticated) {
        // Faceless video costs more credits
        const cost = type === 'facelessVideo' ? 10 : 1;
        setCredits(prev => (prev >= cost ? prev - cost : 0));
        return;
    }
    setUsage(prevUsage => {
      const newUsage = { ...prevUsage, [type]: prevUsage[type] + 1 };
      localStorage.setItem('usageLimits', JSON.stringify(newUsage));
      return newUsage;
    });
  }, [isAuthenticated]);
  
  const checkLimit = useCallback((type: keyof Usage): boolean => {
    if (isAuthenticated) {
        const cost = type === 'facelessVideo' ? 10 : 1;
        return credits >= cost;
    }
    return usage[type] < FREE_LIMITS[type];
  }, [usage, isAuthenticated, credits]);

  const showLoginModal = useCallback(() => {
    if (!isAuthenticated) {
        setIsModalOpen(true);
    }
  }, [isAuthenticated]);
  
  const value = {
    isAuthenticated,
    usage,
    credits,
    login,
    logout,
    checkLimit,
    incrementUsage,
    showLoginModal,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onLogin={login} />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-base-200 rounded-lg shadow-xl p-8 max-w-md w-full relative transform transition-all duration-300 scale-100">
                <button onClick={onClose} className="absolute top-4 right-4 text-content-200 hover:text-white" aria-label="Close modal">
                    <X size={24} />
                </button>
                <div className="text-center">
                    <Award size={48} className="mx-auto text-brand-light mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Unlock Full Access</h2>
                    <p className="text-content-100 mb-6">
                        You've reached your free usage limit. Please sign up or log in to continue creating with unlimited access and premium features.
                    </p>
                    <div className="flex flex-col gap-4">
                         <button onClick={onLogin} className="w-full bg-brand-primary text-white font-bold py-3 px-6 rounded-md hover:bg-brand-secondary transition-colors duration-200">
                            Log In
                        </button>
                        <button onClick={onLogin} className="w-full bg-base-300 text-white font-bold py-3 px-6 rounded-md hover:bg-base-100 transition-colors duration-200">
                           Sign Up
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};