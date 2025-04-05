
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  FileText, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  FileImage,
  Image,
  Package,
  ChevronLeft,
  ChevronRight,
  Download,
  X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Submission {
  id: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  itemCount: number;
}

interface SubmissionDetail {
  id: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  user: {
    name: string;
    employee_id: string;
  };
  items: {
    id: string;
    quantity: number;
    reason: string;
    type: 'breakage' | 'exchange';
    photos: string[];
    product: {
      name: string;
      code: string;
      capacity: number;
    };
  }[];
}

const statusColors = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock size={14} className="mr-1" /> },
  approved: { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle size={14} className="mr-1" /> },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle size={14} className="mr-1" /> },
};

const SubmissionHistory = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [currentSubmission, setCurrentSubmission] = useState<SubmissionDetail | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, dateFilter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      
      // Build query based on filters
      let query = supabase
        .from('submissions')
        .select('id, timestamp, status, comments');
      
      // Add userId filter if not admin
      if (!isAdmin()) {
        query = query.eq('user_id', user?.id);
      }
      
      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate;
        
        switch (dateFilter) {
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'week':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case 'month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          case 'year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
        }
        
        if (startDate) {
          query = query.gte('timestamp', startDate.toISOString());
        }
      }
      
      // Get results ordered by timestamp (newest first)
      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) throw error;
      
      if (data) {
        // Get item count for each submission
        const submissionsWithItemCount = await Promise.all(
          data.map(async (submission) => {
            const { count } = await supabase
              .from('items')
              .select('id', { count: 'exact', head: true })
              .eq('submission_id', submission.id);
            
            return {
              ...submission,
              itemCount: count || 0
            };
          })
        );
        
        setSubmissions(submissionsWithItemCount);
      }
    } catch (error: any) {
      toast({
        title: 'Error fetching submissions',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionDetail = async (id: string) => {
    try {
      // Get submission details
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .select(`
          id, 
          timestamp, 
          status, 
          comments,
          users!inner (
            name,
            employee_id
          )
        `)
        .eq('id', id)
        .single();
      
      if (submissionError || !submission) throw submissionError;
      
      // Get items for this submission
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(`
          id, 
          quantity, 
          reason, 
          type,
          photos,
          products!inner (
            name,
            code,
            capacity
          )
        `)
        .eq('submission_id', id);
      
      if (itemsError) throw itemsError;
      
      // Combine data
      const submissionDetail: SubmissionDetail = {
        id: submission.id,
        timestamp: submission.timestamp,
        status: submission.status,
        comments: submission.comments,
        user: {
          name: submission.users.name,
          employee_id: submission.users.employee_id
        },
        items: items ? items.map(item => ({
          id: item.id,
          quantity: item.quantity,
          reason: item.reason,
          type: item.type,
          photos: item.photos,
          product: {
            name: item.products.name,
            code: item.products.code,
            capacity: item.products.capacity
          }
        })) : []
      };
      
      setCurrentSubmission(submissionDetail);
      setIsDetailDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error fetching submission details',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const downloadAllImages = async () => {
    if (!currentSubmission) return;
    
    try {
      setDownloadingZip(true);
      
      const zip = new JSZip();
      const photoPromises: Promise<void>[] = [];
      
      // Add each photo to the zip
      currentSubmission.items.forEach((item, itemIndex) => {
        item.photos.forEach((photoUrl, photoIndex) => {
          const fileName = `Item${itemIndex + 1}_${item.product.code}_${photoIndex + 1}.jpg`;
          
          const photoPromise = fetch(photoUrl)
            .then(response => response.blob())
            .then(blob => {
              zip.file(fileName, blob);
            });
          
          photoPromises.push(photoPromise);
        });
      });
      
      // Wait for all photos to be added
      await Promise.all(photoPromises);
      
      // Generate and download the zip
      const content = await zip.generateAsync({ type: 'blob' });
      const submissionDate = format(parseISO(currentSubmission.timestamp), 'yyyy-MM-dd');
      saveAs(content, `Submission_${submissionDate}.zip`);
      
      toast({
        title: 'Download complete',
        description: 'All photos have been downloaded as a ZIP file',
      });
    } catch (error: any) {
      toast({
        title: 'Error downloading images',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDownloadingZip(false);
    }
  };
  
  const handleImageClick = (url: string) => {
    setImagePreviewUrl(url);
    setIsImageDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Submission History</h1>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={dateFilter}
            onValueChange={setDateFilter}
          >
            <SelectTrigger className="w-[160px]">
              <Calendar size={16} className="mr-2" />
              <SelectValue placeholder="Filter by date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">Last 30 Days</SelectItem>
              <SelectItem value="year">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={setStatusFilter}
          >
            <SelectTrigger className="w-[160px]">
              <FileText size={16} className="mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {isAdmin() && <TableHead>Submitted By</TableHead>}
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isAdmin() ? 5 : 4} className="text-center py-6">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-company-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin() ? 5 : 4} className="text-center py-6">
                  No submissions found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((submission) => {
                const { bg, text, icon } = statusColors[submission.status];
                return (
                  <TableRow key={submission.id}>
                    <TableCell>
                      {format(parseISO(submission.timestamp), 'MMM dd, yyyy h:mm a')}
                    </TableCell>
                    {isAdmin() && (
                      <TableCell>
                        {/* This will be filled in later when we fetch the submission details */}
                        -
                      </TableCell>
                    )}
                    <TableCell>{submission.itemCount}</TableCell>
                    <TableCell>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${bg} ${text}`}>
                        {icon}
                        <span className="capitalize">{submission.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchSubmissionDetail(submission.id)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Submission Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Submission Details</DialogTitle>
          </DialogHeader>

          {currentSubmission && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Date & Time</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium">
                      {format(parseISO(currentSubmission.timestamp), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(parseISO(currentSubmission.timestamp), 'h:mm a')}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Submitted By</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium">
                      {currentSubmission.user.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      ID: {currentSubmission.user.employee_id}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2">
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${statusColors[currentSubmission.status].bg} ${statusColors[currentSubmission.status].text}`}>
                        {statusColors[currentSubmission.status].icon}
                        <span className="capitalize">{currentSubmission.status}</span>
                      </div>
                      
                      {currentSubmission.comments && (
                        <p className="text-sm text-gray-500 italic mt-2">
                          "{currentSubmission.comments}"
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Items ({currentSubmission.items.length})</h3>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAllImages}
                    disabled={downloadingZip}
                    className="text-company-primary border-company-primary/30"
                  >
                    {downloadingZip ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-company-primary mr-2"></div>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Download size={14} className="mr-2" /> Download All Images
                      </>
                    )}
                  </Button>
                </div>
                
                {currentSubmission.items.map((item, idx) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.type === 'breakage' ? 'destructive' : 'default'}>
                            {item.type === 'breakage' ? 'Breakage' : 'Exchange'}
                          </Badge>
                          <h4 className="font-medium">{item.product.name}</h4>
                        </div>
                        <div className="text-sm text-gray-500 flex gap-2">
                          <span>Code: {item.product.code}</span>
                          <span>•</span>
                          <span>Capacity: {item.product.capacity}ml</span>
                          <span>•</span>
                          <span>Quantity: {item.quantity}</span>
                        </div>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        <div>
                          <h5 className="font-medium text-sm text-gray-500">Reason:</h5>
                          <p>{item.reason}</p>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-sm text-gray-500 mb-2">Photos:</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {item.photos.map((photo, photoIdx) => (
                              <div 
                                key={photoIdx}
                                className="aspect-square rounded border overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => handleImageClick(photo)}
                              >
                                <img src={photo} alt={`Item ${idx + 1} Photo ${photoIdx + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="relative">
            <div className="w-full h-[80vh] flex items-center justify-center bg-black">
              <img 
                src={imagePreviewUrl!} 
                alt="Image Preview" 
                className="max-w-full max-h-full object-contain" 
              />
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
              onClick={() => setIsImageDialogOpen(false)}
            >
              <X />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubmissionHistory;
