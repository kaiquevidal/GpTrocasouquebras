
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login page
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="h-20 w-20 mx-auto mb-6 bg-company-primary rounded-full flex items-center justify-center">
          <span className="text-white text-3xl font-bold">B</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Breakage Management System</h1>
        <p className="text-gray-600 mb-6">Track and manage product breakages and exchanges efficiently</p>
        <div className="space-x-4">
          <Button
            onClick={() => navigate('/login')}
            className="bg-company-primary hover:bg-company-primary/90"
          >
            Login
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/register')}
          >
            Register
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
