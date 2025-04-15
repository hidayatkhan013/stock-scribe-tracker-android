
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  LineChart, 
  DollarSign, 
  FileText, 
  BookOpen, 
  Settings, 
  LogOut 
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const { logout } = useAuth();
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: DollarSign },
    { name: 'Portfolio', href: '/portfolio', icon: BookOpen },
    { name: 'Reports', href: '/reports', icon: LineChart },
    { name: 'Export', href: '/export', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:bg-sidebar md:border-r md:border-sidebar-border">
      <div className="flex items-center justify-center h-16 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-primary">StockScribe</h1>
      </div>
      
      <div className="flex flex-col flex-1 overflow-y-auto pt-5 pb-4">
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-shrink-0 flex border-t border-sidebar-border p-4">
        <button
          onClick={logout}
          className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-destructive hover:bg-sidebar-accent w-full"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
