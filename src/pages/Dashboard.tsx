
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, CheckCircle, XCircle, Plus, FileSpreadsheet, Users } from 'lucide-react';

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    submittedToday: 0,
    totalSubmissions: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalProducts: 0,
    totalUsers: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Today's date for filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        
        // Get pending approvals count
        const { count: pendingCount } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: false })
          .eq('status', 'pending');
        
        // Get submissions made today
        const { count: todayCount } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: false })
          .gte('timestamp', todayISO);
        
        // Get total submissions
        const { count: totalCount } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: false });
        
        // Get approved submissions
        const { count: approvedCount } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: false })
          .eq('status', 'approved');
        
        // Get rejected submissions
        const { count: rejectedCount } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: false })
          .eq('status', 'rejected');
        
        // Get product count
        const { count: productCount } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: false });
          
        // Get user count
        const { count: userCount } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: false })
          .neq('employee_id', '00123456'); // Exclude predefined admin

        setStats({
          pendingApprovals: pendingCount || 0,
          submittedToday: todayCount || 0,
          totalSubmissions: totalCount || 0,
          totalApproved: approvedCount || 0,
          totalRejected: rejectedCount || 0,
          totalProducts: productCount || 0,
          totalUsers: userCount || 0
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      }
    };

    fetchStats();
  }, []);

  const DashboardCard = ({ 
    title, 
    value, 
    icon, 
    description = '', 
    className = '',
    action = null
  }: { 
    title: string; 
    value: number | string; 
    icon: React.ReactNode;
    description?: string;
    className?: string;
    action?: { label: string; onClick: () => void } | null;
  }) => (
    <Card className={`shadow-sm ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        <div className="text-company-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        {action && (
          <Button 
            onClick={action.onClick}
            variant="outline" 
            size="sm"
            className="w-full mt-4 text-company-primary border-company-primary/30 hover:bg-company-primary/10"
          >
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h1>
        <Button 
          onClick={() => navigate('/submissions/new')}
          className="bg-company-primary hover:bg-company-primary/90"
        >
          <Plus size={16} className="mr-2" /> New Submission
        </Button>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <DashboardCard
          title="Pending Approvals"
          value={stats.pendingApprovals}
          icon={<Clock size={20} />}
          className={stats.pendingApprovals > 0 ? "border-l-4 border-l-yellow-400" : ""}
          action={isAdmin() && stats.pendingApprovals > 0 ? { 
            label: "Review",
            onClick: () => navigate('/approvals')
          } : null}
        />
        
        <DashboardCard
          title="Submitted Today"
          value={stats.submittedToday}
          icon={<Package size={20} />}
        />
        
        <DashboardCard
          title="Total Submissions"
          value={stats.totalSubmissions}
          icon={<FileSpreadsheet size={20} />}
        />
        
        {isAdmin() ? (
          <DashboardCard
            title="Total Users"
            value={stats.totalUsers}
            icon={<Users size={20} />}
            action={{ 
              label: "Manage",
              onClick: () => navigate('/users')
            }}
          />
        ) : (
          <DashboardCard
            title="Approved Submissions"
            value={stats.totalApproved}
            icon={<CheckCircle size={20} />}
          />
        )}
        
        {isAdmin() && (
          <>
            <DashboardCard
              title="Total Products"
              value={stats.totalProducts}
              icon={<Package size={20} />}
              action={{ 
                label: "Manage",
                onClick: () => navigate('/products')
              }}
            />
            
            <DashboardCard
              title="Approved Submissions"
              value={stats.totalApproved}
              icon={<CheckCircle size={20} />}
            />
            
            <DashboardCard
              title="Rejected Submissions"
              value={stats.totalRejected}
              icon={<XCircle size={20} />}
            />
          </>
        )}
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="text-center p-6 text-gray-500">
              <p>Recent activity will be displayed here</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => navigate('/submissions/new')}
              >
                <Package size={16} className="mr-2" /> New Submission
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/submissions/history')}
              >
                <Clock size={16} className="mr-2" /> View History
              </Button>
              {isAdmin() && (
                <>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/products')}
                  >
                    <Package size={16} className="mr-2" /> Manage Products
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/reports')}
                  >
                    <FileSpreadsheet size={16} className="mr-2" /> Generate Reports
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
