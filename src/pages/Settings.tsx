
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings, Lock, User, Shield, Loader2 } from 'lucide-react';
import bcrypt from 'bcryptjs';

const SettingsPage = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [fullName, setFullName] = useState(user?.name || '');
  
  const [loading, setLoading] = useState(false);
  
  // Password Change Handler
  const handleChangePassword = async () => {
    try {
      setLoading(true);
      
      // Validate passwords
      if (newPassword !== confirmPassword) {
        toast({
          title: 'Password mismatch',
          description: 'Your new password and confirmation do not match',
          variant: 'destructive',
        });
        return;
      }
      
      if (newPassword.length < 6) {
        toast({
          title: 'Password too short',
          description: 'Your new password must be at least 6 characters long',
          variant: 'destructive',
        });
        return;
      }
      
      // Get current password hash from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('password')
        .eq('id', user?.id)
        .single();
      
      if (userError || !userData) {
        throw new Error('Failed to retrieve user data');
      }
      
      // Admin user doesn't need to verify current password
      if (user?.id !== 'admin') {
        // Verify current password
        const passwordMatch = await bcrypt.compare(currentPassword, userData.password);
        
        if (!passwordMatch) {
          toast({
            title: 'Current password incorrect',
            description: 'The current password you entered is incorrect',
            variant: 'destructive',
          });
          return;
        }
      }
      
      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', user?.id);
      
      if (updateError) {
        throw new Error('Failed to update password');
      }
      
      // Log activity
      if (user?.id !== 'admin') {
        await supabase.from('logs').insert({
          user_id: user?.id,
          action: 'change_password',
          details: 'User changed password',
        });
      }
      
      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully',
      });
      
      // Reset form and close dialog
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error changing password',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Profile Update Handler
  const handleUpdateProfile = async () => {
    try {
      setLoading(true);
      
      // Validate name
      if (!fullName.trim()) {
        toast({
          title: 'Name required',
          description: 'Please enter your full name',
          variant: 'destructive',
        });
        return;
      }
      
      // Update profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({ name: fullName.trim() })
        .eq('id', user?.id);
      
      if (updateError) {
        throw new Error('Failed to update profile');
      }
      
      // Log activity
      if (user?.id !== 'admin') {
        await supabase.from('logs').insert({
          user_id: user?.id,
          action: 'update_profile',
          details: 'User updated profile information',
        });
      }
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully',
      });
      
      // Update local user state (would need to be handled by Auth context in a real app)
      
      // Close dialog
      setIsProfileOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error updating profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
      </div>
      
      <div className="grid gap-6">
        {/* Account Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-company-primary" />
              <CardTitle>Account Settings</CardTitle>
            </div>
            <CardDescription>
              Manage your personal account settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Profile Information */}
            <div>
              <h3 className="text-lg font-medium">Profile Information</h3>
              <Separator className="my-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div>
                  <Label>Full Name</Label>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 mt-1">
                    <span>{user?.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsProfileOpen(true)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Employee ID</Label>
                  <div className="rounded-md border px-3 py-2 mt-1 bg-gray-50">
                    <span className="text-gray-600">{user?.employee_id}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Employee ID cannot be changed
                  </p>
                </div>
              </div>
            </div>
            
            {/* Security */}
            <div>
              <h3 className="text-lg font-medium">Security</h3>
              <Separator className="my-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div>
                  <Label>Password</Label>
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 mt-1">
                    <span>••••••••</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsPasswordOpen(true)}
                    >
                      Change
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Role</Label>
                  <div className="rounded-md border px-3 py-2 mt-1 bg-gray-50 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <span className="capitalize text-gray-600">
                      {isAdmin() ? 'Administrator' : 'User'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Role can only be changed by administrators
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* System Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-company-primary" />
              <CardTitle>System Information</CardTitle>
            </div>
            <CardDescription>
              Details about the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Application Version</Label>
                <div className="rounded-md border px-3 py-2 mt-1 bg-gray-50">
                  <span className="text-gray-600">1.0.0</span>
                </div>
              </div>
              <div>
                <Label>Build Date</Label>
                <div className="rounded-md border px-3 py-2 mt-1 bg-gray-50">
                  <span className="text-gray-600">April 5, 2025</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Change Password Dialog */}
      <AlertDialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Password</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current password and your new password below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Current Password (not required for admin user) */}
            {user?.id !== 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                />
              </div>
            )}
            
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
              />
              <p className="text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>
            
            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleChangePassword}
              disabled={loading}
              className="bg-company-primary hover:bg-company-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock size={16} className="mr-2" />
                  Change Password
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit Profile Dialog */}
      <AlertDialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Update your profile information.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdateProfile}
              disabled={loading}
              className="bg-company-primary hover:bg-company-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsPage;
