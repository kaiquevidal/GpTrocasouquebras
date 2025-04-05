
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Edit, Trash, UserCog, ShieldCheck } from 'lucide-react';

interface User {
  id: string;
  employee_id: string;
  name: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    role: 'user',
    status: 'active'
  });
  
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('employee_id', '00123456') // Exclude the hardcoded admin
        .order('name');

      if (error) throw error;
      
      if (data) {
        setUsers(data as User[]);
      }
    } catch (error: any) {
      toast({
        title: "Error fetching users",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const openEditDialog = (user: User) => {
    setCurrentUser(user);
    setFormData({
      name: user.name,
      role: user.role,
      status: user.status,
    });
    setIsUserDialogOpen(true);
  };

  const openDeleteDialog = (user: User) => {
    setCurrentUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      if (!currentUser) return;
      
      // Validate form data
      if (!formData.name.trim()) {
        toast({
          title: "Validation Error",
          description: "User name is required",
          variant: "destructive",
        });
        return;
      }

      // Prevent self-deactivation
      if (currentUser.id === authUser?.id && formData.status === 'inactive') {
        toast({
          title: "Not allowed",
          description: "You cannot deactivate your own account",
          variant: "destructive",
        });
        return;
      }

      const userData = {
        name: formData.name.trim(),
        role: formData.role as 'admin' | 'user',
        status: formData.status as 'active' | 'inactive',
      };

      // Update user
      const { error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', currentUser.id);

      if (error) throw error;

      toast({
        title: "User updated",
        description: `${userData.name} has been updated successfully`,
      });
      
      // Close dialog and refresh users
      setIsUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error updating user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    try {
      if (!currentUser) return;
      
      // Prevent self-deletion
      if (currentUser.id === authUser?.id) {
        toast({
          title: "Not allowed",
          description: "You cannot delete your own account",
          variant: "destructive",
        });
        setIsDeleteDialogOpen(false);
        return;
      }

      // Check if user has submissions
      const { count } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);

      if (count && count > 0) {
        // Soft delete by deactivating instead
        const { error } = await supabase
          .from('users')
          .update({ status: 'inactive' })
          .eq('id', currentUser.id);

        if (error) throw error;

        toast({
          title: "User deactivated",
          description: `${currentUser.name} has been deactivated instead of deleted because they have submission history`,
        });
      } else {
        // Hard delete if no submissions
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', currentUser.id);

        if (error) throw error;

        toast({
          title: "User deleted",
          description: `${currentUser.name} has been deleted successfully`,
        });
      }

      // Close dialog and refresh users
      setIsDeleteDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Apply filters
  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.employee_id.includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = 
      statusFilter === 'all' || user.status === statusFilter;
    
    // Role filter
    const matchesRole = 
      roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search users by name or ID..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 md:w-auto">
          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={roleFilter}
            onValueChange={setRoleFilter}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-company-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  No users found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.employee_id}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' 
                        ? 'bg-company-primary/10 text-company-primary' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'admin' && <ShieldCheck size={12} className="mr-1" />}
                      {user.role === 'user' && <UserCog size={12} className="mr-1" />}
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-1 ${
                        user.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(user)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        disabled={user.id === authUser?.id} // Can't delete yourself
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <div className="h-10 px-3 py-2 rounded-md border bg-gray-100 text-gray-500">
                {currentUser?.employee_id}
              </div>
              <p className="text-xs text-gray-500">
                Employee ID cannot be changed
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="Enter user name"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={formData.role === 'admin'}
                  onCheckedChange={(checked) => 
                    handleFormChange('role', checked ? 'admin' : 'user')
                  }
                  id="role-switch"
                  disabled={currentUser?.id === authUser?.id} // Can't change own role
                />
                <Label htmlFor="role-switch" className="cursor-pointer">
                  {formData.role === 'admin' ? 'Admin' : 'User'}
                </Label>
                {currentUser?.id === authUser?.id && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Can't change your own role)
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) => 
                    handleFormChange('status', checked ? 'active' : 'inactive')
                  }
                  id="status-switch"
                  disabled={currentUser?.id === authUser?.id} // Can't deactivate yourself
                />
                <Label htmlFor="status-switch" className="cursor-pointer">
                  {formData.status === 'active' ? 'Active' : 'Inactive'}
                </Label>
                {currentUser?.id === authUser?.id && (
                  <span className="text-xs text-gray-500 ml-2">
                    (Can't deactivate yourself)
                  </span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUser}
              className="bg-company-primary hover:bg-company-primary/90"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will remove ${currentUser?.name} from the system. If they have any submissions, their account will be deactivated instead of deleted to preserve submission history.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Users;
