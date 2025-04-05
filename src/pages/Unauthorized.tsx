
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full bg-red-100 flex items-center justify-center">
            <ShieldAlert size={48} className="text-red-500" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page. Please contact an administrator if you believe this is an error.
        </p>
        
        <Button 
          onClick={() => navigate('/dashboard')}
          className="bg-company-primary hover:bg-company-primary/90"
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default Unauthorized;
