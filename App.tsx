import React, { useState } from 'react';
import { ImageEditor } from './components/ImageEditor';
import { VideoGenerator } from './components/VideoGenerator';
import { TTSGenerator } from './components/TTSGenerator';
import { FacelessVideoGenerator } from './components/FacelessVideoGenerator';
import { AuthProvider, useAuth } from './components/Auth';
import { Camera, Video, Mic, LogIn, LogOut, Award, Menu, X, Bot } from 'lucide-react';

type Tab = 'image' | 'video' | 'tts' | 'faceless';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
};

const Header: React.FC = () => {
    const { isAuthenticated, usage, credits, login, logout } = useAuth();
    const FREE_LIMITS = { image: 5, video: 2, audio: 3, facelessVideo: 1 };

    return (
        <div className="flex-grow flex items-center justify-end gap-4">
            {!isAuthenticated ? (
                <div className="hidden sm:flex items-center gap-4 text-sm text-content-200">
                    <span><Camera size={16} className="inline mr-1" /> {Math.max(0, FREE_LIMITS.image - usage.image)} free</span>
                    <span><Video size={16} className="inline mr-1" /> {Math.max(0, FREE_LIMITS.video - usage.video)} free</span>
                    <span><Mic size={16} className="inline mr-1" /> {Math.max(0, FREE_LIMITS.audio - usage.audio)} free</span>
                    <span><Bot size={16} className="inline mr-1" /> {Math.max(0, FREE_LIMITS.facelessVideo - usage.facelessVideo)} free</span>
                </div>
            ) : (
                <div className="flex items-center gap-2 bg-base-300 px-3 py-1 rounded-full text-sm">
                    <Award size={16} className="text-yellow-400" />
                    <span>{credits} Credits</span>
                </div>
            )}
            {isAuthenticated ? (
                <button onClick={logout} className="flex items-center gap-2 bg-base-300 px-4 py-2 rounded-md hover:bg-brand-dark transition-colors">
                    <LogOut size={16} />
                    <span className="hidden md:inline">Logout</span>
                </button>
            ) : (
                 <button onClick={login} className="flex items-center gap-2 bg-brand-primary px-4 py-2 rounded-md hover:bg-brand-secondary transition-colors">
                    <LogIn size={16} />
                    <span className="hidden md:inline">Login / Sign Up</span>
                </button>
            )}
        </div>
    );
};


const AppLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('faceless');
  const [productImage, setProductImage] = useState<{ base64: string; mimeType: string; name: string; } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'image':
        return <ImageEditor onImageUpload={setProductImage} initialImage={productImage} />;
      case 'video':
        return <VideoGenerator sourceImage={productImage} />;
      case 'tts':
        return <TTSGenerator />;
      case 'faceless':
        return <FacelessVideoGenerator />;
      default:
        return <FacelessVideoGenerator />;
    }
  };

  const TabButton: React.FC<{ tabName: Tab; icon: React.ReactNode; label: string; }> = ({ tabName, icon, label }) => (
    <button
      onClick={() => {
        setActiveTab(tabName);
        setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-4 px-4 py-3 rounded-md transition-colors duration-200 text-lg ${
        activeTab === tabName
          ? 'bg-brand-secondary text-white'
          : 'text-content-200 hover:bg-base-300 hover:text-white'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-base-100 flex font-sans text-content-100">
      <aside className={`bg-base-200 shadow-lg fixed lg:relative lg:translate-x-0 w-64 h-full z-30 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 flex flex-col h-full">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-white">AI Studio</h1>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-content-200 hover:text-white">
                    <X size={24} />
                </button>
            </div>
            <nav className="flex flex-col gap-2">
                <TabButton tabName="faceless" icon={<Bot size={24} />} label="Faceless Video" />
                <TabButton tabName="image" icon={<Camera size={24} />} label="Photo Editor" />
                <TabButton tabName="video" icon={<Video size={24} />} label="Video Generator" />
                <TabButton tabName="tts" icon={<Mic size={24} />} label="Audio Creator" />
            </nav>
        </div>
      </aside>

      <div className="flex flex-col flex-grow w-full lg:w-auto">
        <header className="bg-base-200 shadow-md sticky top-0 z-20 flex items-center px-4 py-3">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-content-100 mr-4">
                <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold capitalize text-white hidden md:block">{activeTab === 'tts' ? 'Audio Creator' : `${activeTab} Studio`}</h2>
            <Header />
        </header>
        
        <main className="flex-grow p-4 md:p-6 overflow-auto">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
};

export default App;