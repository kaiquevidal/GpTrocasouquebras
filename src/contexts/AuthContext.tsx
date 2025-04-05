
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// Define types for our context
export interface User {
  id: string;
  employee_id: string;
  name: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (employee_id: string, password: string) => Promise<void>;
  register: (employee_id: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check for user session on initial load
    const storedUser = localStorage.getItem('breakage_user');
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('breakage_user');
      }
    }
    
    setLoading(false);
  }, []);

  const login = async (employee_id: string, password: string) => {
    try {
      setLoading(true);
      
      // Special case for predefined admin
      if (employee_id === '00123456' && password === 'admin') {
        const adminUser: User = {
          id: 'admin',
          employee_id: '00123456',
          name: 'Administrator',
          role: 'admin',
          status: 'active'
        };
        
        setUser(adminUser);
        localStorage.setItem('breakage_user', JSON.stringify(adminUser));
        toast({
          title: "Login successful",
          description: "Welcome Administrator!",
        });
        navigate('/dashboard');
        return;
      }
      
      // Regular user login flow
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('employee_id', employee_id)
        .eq('status', 'active')
        .single();

      if (error || !users) {
        throw new Error('Invalid employee ID or account inactive');
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, users.password);
      
      if (!passwordMatch) {
        throw new Error('Invalid password');
      }

      const loggedInUser: User = {
        id: users.id,
        employee_id: users.employee_id,
        name: users.name,
        role: users.role,
        status: users.status
      };

      setUser(loggedInUser);
      localStorage.setItem('breakage_user', JSON.stringify(loggedInUser));

      // Log login activity
      await supabase.from('logs').insert({
        user_id: users.id,
        action: 'login',
        details: 'User logged in'
      });

      toast({
        title: "Login successful",
        description: `Welcome ${users.name}!`,
      });
      
      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const register = async (employee_id: string, name: string, password: string) => {
    try {
      setLoading(true);
      
      // Check if employee ID already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('employee_id', employee_id)
        .single();

      if (existingUser) {
        throw new Error('Employee ID already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          employee_id,
          name,
          password: hashedPassword,
          role: 'user',
          status: 'active'
        })
        .select()
        .single();

      if (error || !newUser) {
        throw new Error('Failed to create account');
      }

      toast({
        title: "Registration successful",
        description: "Your account has been created. You can now log in.",
      });
      
      navigate('/login');
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive"
      });
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (user) {
        // Log logout activity if not admin
        if (user.id !== 'admin') {
          await supabase.from('logs').insert({
            user_id: user.id,
            action: 'logout',
            details: 'User logged out'
          });
        }
      }
      
      // Clear user from state and localStorage
      setUser(null);
      localStorage.removeItem('breakage_user');
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
