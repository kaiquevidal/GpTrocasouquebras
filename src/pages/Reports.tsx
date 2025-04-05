import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileSpreadsheet, 
  Calendar, 
  Download, 
  Loader2, 
  Package, 
  User,
  Search
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import * as XLSX from 'xlsx';

interface ReportItem {
  id: string;
  product_code: string;
  product_name: string;
  capacity_ml: number;
  quantity: number;
  reason: string;
  type: 'breakage' | 'exchange';
  user_name: string;
  user_id: string;
  timestamp: string;
}

const Reports = () => {
  const { toast } = useToast();
  
  const [dateRange, setDateRange] = useState<'7days' | '30days' | 'month' | 'year' | 'custom'>('30days');
  const [startDate, setStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [productFilter, setProductFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'rejected'>('approved');
  
  const [reportData, setReportData] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [products, setProducts] = useState<{id: string, name: string, code: string}[]>([]);
  const [users, setUsers] = useState<{id: string, name: string, employee_id: string}[]>([]);
  
  // Handle date range change
  const handleDateRangeChange = (range: '7days' | '30days' | 'month' | 'year' | 'custom') => {
    setDateRange(range);
    
    const now = new Date();
    let start, end;
    
    switch (range) {
      case '7days':
        start = subDays(now, 7);
        end = now;
        break;
      case '30days':
        start = subDays(now, 30);
        end = now;
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'custom':
        // Keep existing custom dates
        return;
    }
    
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };
  
  // Load products and users for filtering
  const loadFilterData = async () => {
    try {
      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, code')
        .order('name');
      
      if (productsError) throw productsError;
      setProducts(productsData || []);
      
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, employee_id')
        .order('name');
      
      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error: any) {
      toast({
        title: 'Error loading filter data',
        description: error.message,
        variant: 'destructive',
      });
    }
  };
  
  // Generate the report
  const generateReport = async () => {
    try {
      setLoading(true);
      
      // Ensure filter data is loaded
      if (products.length === 0 || users.length === 0) {
        await loadFilterData();
      }
      
      // Format dates for query
      const fromDate = new Date(startDate);
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(endDate);
      toDate.setHours(23, 59, 59, 999);
      
      // Build query for submissions in date range and with status filter
      let query = supabase
        .from('submissions')
        .select(`
          id, 
          timestamp, 
          users!inner (
            id,
            name,
            employee_id
          )
        `)
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString());
      
      // Apply status filter if not "all"
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Apply user filter if specified
      if (userFilter) {
        query = query.eq('users.id', userFilter);
      }
      
      const { data: submissions, error: submissionsError } = await query;
      
      if (submissionsError) throw submissionsError;
      
      // For each submission, get its items
      const reportItems: ReportItem[] = [];
      
      for (const submission of submissions || []) {
        // Build item query
        let itemQuery = supabase
          .from('items')
          .select(`
            id,
            quantity,
            reason,
            type,
            products!inner (
              name,
              code,
              capacity
            )
          `)
          .eq('submission_id', submission.id);
        
        // Apply product filter if specified
        if (productFilter) {
          itemQuery = itemQuery.eq('products.id', productFilter);
        }
        
        const { data: items, error: itemsError } = await itemQuery;
        
        if (itemsError) throw itemsError;
        
        // Add items to report data
        for (const item of items || []) {
          reportItems.push({
            id: item.id,
            product_code: item.products.code,
            product_name: item.products.name,
            capacity_ml: item.products.capacity,
            quantity: item.quantity,
            reason: item.reason,
            type: item.type,
            user_name: submission.users.name,
            user_id: submission.users.employee_id,
            timestamp: submission.timestamp,
          });
        }
      }
      
      setReportData(reportItems);
    } catch (error: any) {
      toast({
        title: 'Error generating report',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Export to Excel
  const exportToExcel = () => {
    try {
      setDownloading(true);
      
      if (reportData.length === 0) {
        toast({
          title: 'No data to export',
          description: 'Please generate a report first',
          variant: 'destructive',
        });
        setDownloading(false);
        return;
      }
      
      // Create worksheet data
      const worksheet = XLSX.utils.json_to_sheet(
        reportData.map(item => ({
          'Date': format(new Date(item.timestamp), 'yyyy-MM-dd'),
          'Time': format(new Date(item.timestamp), 'HH:mm:ss'),
          'Type': item.type === 'breakage' ? 'Breakage' : 'Exchange',
          'Product Code': item.product_code,
          'Product Name': item.product_name,
          'Capacity (ml)': item.capacity_ml,
          'Quantity': item.quantity,
          'User ID': item.user_id,
          'User Name': item.user_name,
          'Reason': item.reason,
        }))
      );
      
      // Auto-size columns
      const maxWidths = {};
      
      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      
      // Generate filename with current date
      const fileName = `Breakage_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      
      // Export workbook
      XLSX.writeFile(workbook, fileName);
      
      toast({
        title: 'Export successful',
        description: 'Report has been downloaded as an Excel file',
      });
    } catch (error: any) {
      toast({
        title: 'Error exporting report',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
      </div>
      
      {/* Filter Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Report Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Date Range Selection */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <Button
                  variant={dateRange === '7days' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => handleDateRangeChange('7days')}
                >
                  Last 7 Days
                </Button>
                <Button
                  variant={dateRange === '30days' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => handleDateRangeChange('30days')}
                >
                  Last 30 Days
                </Button>
                <Button
                  variant={dateRange === 'month' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => handleDateRangeChange('month')}
                >
                  This Month
                </Button>
                <Button
                  variant={dateRange === 'year' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => handleDateRangeChange('year')}
                >
                  This Year
                </Button>
                <Button
                  variant={dateRange === 'custom' ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => handleDateRangeChange('custom')}
                >
                  Custom
                </Button>
              </div>
            </div>
            
            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">From Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={dateRange !== 'custom'}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">To Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={dateRange !== 'custom'}
                />
              </div>
            </div>
            
            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Product</Label>
                <Select value={productFilter} onValueChange={setProductFilter} onOpenChange={loadFilterData}>
                  <SelectTrigger>
                    <div className="flex items-center">
                      <Package className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="All Products" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Products</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>User</Label>
                <Select value={userFilter} onValueChange={setUserFilter} onOpenChange={loadFilterData}>
                  <SelectTrigger>
                    <div className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="All Users" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Users</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="approved">Approved Only</SelectItem>
                    <SelectItem value="rejected">Rejected Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Generate Button */}
            <div className="flex justify-end">
              <Button
                onClick={generateReport}
                disabled={loading}
                className="bg-company-primary hover:bg-company-primary/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Results Card */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">
            Report Results ({reportData.length} items)
          </CardTitle>
          
          {reportData.length > 0 && (
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={downloading}
              className="text-company-primary border-company-primary/30"
            >
              {downloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export to Excel
                </>
              )}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {reportData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <p>No data to display. Generate a report using the filters above.</p>
              <p className="text-sm mt-2">Reports will show breakage and exchange submissions based on your criteria.</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Capacity</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{format(new Date(item.timestamp), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                          item.type === 'breakage' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.type === 'breakage' ? 'Breakage' : 'Exchange'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{item.product_name}</div>
                          <div className="text-xs text-gray-500">{item.product_code}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.capacity_ml} ml</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell>
                        <div>
                          <div>{item.user_name}</div>
                          <div className="text-xs text-gray-500">{item.user_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.reason}>
                        {item.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
