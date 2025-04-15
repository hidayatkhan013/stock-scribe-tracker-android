
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, User, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface TopBarProps {
  title: string;
}

const TopBar = ({ title }: TopBarProps) => {
  const { currentUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const handleLogout = () => {
    logout();
  };

  const userInitials = currentUser?.username
    ? currentUser.username.substring(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="bg-background border-b border-border px-4 py-2 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center">
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold ml-2">{title}</h1>
      </div>
      
      <div className="flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleLogout}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 flex z-40">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-sidebar">
            <div className="absolute top-0 right-0 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
            
            {/* Mobile sidebar content - similar to desktop Sidebar but mobile optimized */}
            <div className="flex-1 h-0 pt-14 pb-4 overflow-y-auto">
              <nav className="mt-5 px-2 space-y-1">
                <a 
                  href="/" 
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md bg-primary text-white"
                >
                  Dashboard
                </a>
                <a 
                  href="/transactions" 
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Transactions
                </a>
                <a 
                  href="/portfolio" 
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Portfolio
                </a>
                <a 
                  href="/reports" 
                  className="group flex items-center px-2 py-2 text-base font-medium rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  Reports
                </a>
              </nav>
            </div>
            
            <div className="flex-shrink-0 flex border-t border-sidebar-border p-4">
              <div className="flex items-center">
                <div>
                  <Avatar className="inline-block h-9 w-9 rounded-full">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-sidebar-foreground">
                    {currentUser?.username}
                  </p>
                  <button
                    onClick={handleLogout}
                    className="text-xs font-medium text-destructive hover:text-destructive-foreground"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopBar;
