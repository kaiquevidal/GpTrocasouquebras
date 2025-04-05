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
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, 
  CheckCircle,
  XCircle,
  Clock,
  Image,
  X,
  Check,
  Download,
  Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface PendingSubmission {
  id: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    employee_id: string;
  };
  itemCount: number;
  firstImage?: string;
}

interface SubmissionDetail {
  id: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
  user: {
    id: string;
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

const Approvals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSubmission, setCurrentSubmission] = useState<SubmissionDetail | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  useEffect(() => {
    fetchPendingSubmissions();
  }, []);

  const fetchPendingSubmissions = async () => {
    try {
      setLoading(true);
      
      // Get all pending submissions
      const { data: submissions, error } = await supabase
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
        .eq('status', 'pending')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      
      if (submissions) {
        // Get item count and first image for each submission
        const submissionsWithDetails = await Promise.all(
          submissions.map(async (submission) => {
            // Get item count
            const { count } = await supabase
              .from('items')
              .select('id', { count: 'exact', head: true })
              .eq('submission_id', submission.id);
            
            // Get first image
            const { data: items } = await supabase
              .from('items')
              .select('photos')
              .eq('submission_id', submission.id)
              .limit(1);
            
            let firstImage;
            if (items && items.length > 0 && items[0].photos && items[0].photos.length > 0) {
              firstImage = items[0].photos[0];
            }
            
            return {
              id: submission.id,
              timestamp: submission.timestamp,
              user: {
                id: submission.users.id,
                name: submission.users.name,
                employee_id: submission.users.employee_id,
              },
              itemCount: count || 0,
              firstImage,
            };
          })
        );
        
        setPendingSubmissions(submissionsWithDetails);
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
          users!inner (
            id,
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
      
      // Combine data and transform the products property into product
      const submissionDetail: SubmissionDetail = {
        id: submission.id,
        timestamp: submission.timestamp,
        status: submission.status,
        user: {
          id: submission.users.id,
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
      setComments('');
    } catch (error: any) {
      toast({
        title: 'Error fetching submission details',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!currentSubmission) return;
    
    try {
      setIsProcessing(true);
      
      // Update submission status
      const { error } = await supabase
        .from('submissions')
        .update({
          status: approved ? 'approved' : 'rejected',
          comments: comments.trim() || null
        })
        .eq('id', currentSubmission.id);

      if (error) throw error;
      
      // Log activity
      await supabase.from('logs').insert({
        user_id: user!.id,
        action: approved ? 'approve_submission' : 'reject_submission',
        details: `${approved ? 'Approved' : 'Rejected'} submission ID: ${currentSubmission.id}`,
      });
      
      toast({
        title: approved ? 'Submission approved' : 'Submission rejected',
        description: 'The submission has been updated successfully',
      });
      
      // Close dialog and refresh list
      setIsDetailDialogOpen(false);
      fetchPendingSubmissions();
    } catch (error: any) {
      toast({
        title: 'Error updating submission',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
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
      const userName = currentSubmission.user.name.replace(/\s+/g, '_');
      saveAs(content, `${userName}_${submissionDate}.zip`);
      
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
        <h1 className="text-2xl font-bold text-gray-800">Pending Approvals</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Preview</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Items</TableHead>
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
            ) : pendingSubmissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  <div className="space-y-2">
                    <p>No pending submissions requiring approval</p>
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              pendingSubmissions.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    {submission.firstImage ? (
                      <div className="h-12 w-12 rounded overflow-hidden border">
                        <img 
                          src={submission.firstImage} 
                          alt="Preview" 
                          className="h-full w-full object-cover"
                          onClick={() => handleImageClick(submission.firstImage!)}
                        />
                      </div>
                    ) : (
                      <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center">
                        <Image size={16} className="text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(parseISO(submission.timestamp), 'MMM dd, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{submission.user.name}</div>
                      <div className="text-xs text-gray-500">ID: {submission.user.employee_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>{submission.itemCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchSubmissionDetail(submission.id)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Submission Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Review Submission</DialogTitle>
          </DialogHeader>

          {currentSubmission && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Submission Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Date:</dt>
                        <dd className="font-medium">
                          {format(parseISO(currentSubmission.timestamp), 'MMM dd, yyyy h:mm a')}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Item Count:</dt>
                        <dd className="font-medium">{currentSubmission.items.length}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-500">Submitted By</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Name:</dt>
                        <dd className="font-medium">{currentSubmission.user.name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-500">Employee ID:</dt>
                        <dd className="font-medium">{currentSubmission.user.employee_id}</dd>
                      </div>
                    </dl>
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
                        <div className="text-sm text-gray-500 flex flex-wrap gap-2">
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

              <div className="space-y-2">
                <h3 className="text-md font-medium">Comments</h3>
                <Textarea 
                  placeholder="Add your comments here (optional)" 
                  className="min-h-24"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                />
              </div>

              <DialogFooter className="space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDetailDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                
                <Button 
                  variant="destructive"
                  onClick={() => handleApproval(false)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <X size={16} className="mr-2" />
                      Reject
                    </>
                  )}
                </Button>
                
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApproval(true)}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check size={16} className="mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
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

export default Approvals;
