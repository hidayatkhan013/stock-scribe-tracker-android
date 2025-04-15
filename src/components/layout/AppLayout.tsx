
import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
}

const AppLayout = ({ children, title }: AppLayoutProps) => {
  const { currentUser, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !currentUser) {
      navigate('/login');
    }
  }, [currentUser, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
