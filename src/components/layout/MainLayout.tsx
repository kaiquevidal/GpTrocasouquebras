
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Menu, X, LogOut, Home, Package, History, 
  Users, FileSpreadsheet, CheckSquare, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const menuItems: SidebarItem[] = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: <Home size={20} />,
    },
    {
      name: 'New Submission',
      path: '/submissions/new',
      icon: <Package size={20} />,
    },
    {
      name: 'Submission History',
      path: '/submissions/history',
      icon: <History size={20} />,
    },
    {
      name: 'Approvals',
      path: '/approvals',
      icon: <CheckSquare size={20} />,
      adminOnly: true,
    },
    {
      name: 'Products',
      path: '/products',
      icon: <Package size={20} />,
      adminOnly: true,
    },
    {
      name: 'Users',
      path: '/users',
      icon: <Users size={20} />,
      adminOnly: true,
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: <FileSpreadsheet size={20} />,
      adminOnly: true,
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: <Settings size={20} />,
    },
  ];

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-20"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-full bg-company-primary flex items-center justify-center text-white font-bold">
              B
            </div>
            <h1 className="text-lg font-semibold text-company-primary">Breakage Manager</h1>
          </div>
          {isMobile && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleSidebar}
            >
              <X size={20} />
            </Button>
          )}
        </div>

        {/* User Info */}
        {user && (
          <div className="py-4 px-4 border-b border-gray-200">
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-gray-500">
              {user.employee_id} - {isAdmin() ? 'Admin' : 'User'}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems
            .filter(item => !item.adminOnly || isAdmin())
            .map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  location.pathname === item.path
                    ? "bg-gray-100 text-company-primary"
                    : "text-gray-700 hover:bg-gray-50"
                )}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) {
                    setSidebarOpen(false);
                  }
                }}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Button>
            ))}
          
          {/* Logout Button */}
          <Button
            variant="ghost"
            className="w-full justify-start text-left font-normal text-gray-700 hover:bg-gray-50 mt-6"
            onClick={logout}
          >
            <span className="mr-3"><LogOut size={20} /></span>
            Logout
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center px-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleSidebar}
            className="lg:hidden"
          >
            <Menu size={20} />
          </Button>
          <div className="ml-4 lg:ml-0">
            <h2 className="text-xl font-semibold text-gray-800">
              {menuItems.find(item => item.path === location.pathname)?.name || 'Page'}
            </h2>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
