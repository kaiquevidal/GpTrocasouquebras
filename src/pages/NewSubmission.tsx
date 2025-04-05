
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
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
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Check, 
  ChevronsUpDown, 
  Loader2, 
  Trash, 
  Upload, 
  X, 
  Plus,
  ImagePlus,
  Image
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

type Product = {
  id: string;
  name: string;
  code: string;
  capacity: number;
};

type SubmissionItem = {
  id: string;
  productId: string;
  product: Product | null;
  quantity: number;
  reason: string;
  type: 'breakage' | 'exchange';
  photos: File[];
  photoUrls: string[];
  uploading: boolean;
};

const NewSubmission = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isProductsOpen, setIsProductsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentItem, setCurrentItem] = useState<SubmissionItem | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  
  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<{
    items: SubmissionItem[];
  }>({
    defaultValues: {
      items: []
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });
  
  const items = watch('items');
  
  // Fetch products when product selector is opened
  const handleProductSelectorOpen = async (open: boolean) => {
    setIsProductsOpen(open);
    
    if (open && products.length === 0) {
      setIsProductsLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');
        
        if (error) throw error;
        
        if (data) {
          setProducts(data);
        }
      } catch (error: any) {
        toast({
          title: 'Error loading products',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        setIsProductsLoading(false);
      }
    }
  };
  
  // Handle product selection
  const handleProductSelect = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setSelectedProductId(productId);
      if (currentItem) {
        setCurrentItem({
          ...currentItem,
          productId,
          product,
        });
      }
    }
    setIsProductsOpen(false);
  };
  
  // File dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': []
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        toast({
          title: 'File upload error',
          description: 'Only image files up to 5MB are allowed',
          variant: 'destructive',
        });
        return;
      }
      
      if (currentItem) {
        // Create object URLs for preview
        const newPhotos = acceptedFiles.map(file => {
          // Create a blob URL for preview
          const url = URL.createObjectURL(file);
          return file;
        });
        
        const newPhotoUrls = acceptedFiles.map(file => URL.createObjectURL(file));
        
        setCurrentItem({
          ...currentItem,
          photos: [...currentItem.photos, ...newPhotos],
          photoUrls: [...currentItem.photoUrls, ...newPhotoUrls],
        });
      }
    },
  });
  
  // Remove image from preview
  const removePhoto = (index: number) => {
    if (currentItem) {
      const newPhotos = [...currentItem.photos];
      const newPhotoUrls = [...currentItem.photoUrls];
      
      // Revoke the object URL to avoid memory leaks
      URL.revokeObjectURL(newPhotoUrls[index]);
      
      newPhotos.splice(index, 1);
      newPhotoUrls.splice(index, 1);
      
      setCurrentItem({
        ...currentItem,
        photos: newPhotos,
        photoUrls: newPhotoUrls,
      });
    }
  };
  
  // Create a new item
  const createNewItem = () => {
    setSelectedProductId(null);
    setCurrentItem({
      id: uuidv4(),
      productId: '',
      product: null,
      quantity: 1,
      reason: '',
      type: 'breakage',
      photos: [],
      photoUrls: [],
      uploading: false,
    });
  };
  
  // Add current item to list
  const addCurrentItemToList = () => {
    if (!currentItem) return;
    
    // Validate required fields
    if (!currentItem.productId || !currentItem.product) {
      toast({
        title: 'Validation error',
        description: 'Please select a product',
        variant: 'destructive',
      });
      return;
    }
    
    if (currentItem.quantity <= 0) {
      toast({
        title: 'Validation error',
        description: 'Quantity must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    if (!currentItem.reason) {
      toast({
        title: 'Validation error',
        description: 'Please provide a reason',
        variant: 'destructive',
      });
      return;
    }
    
    if (currentItem.photos.length === 0) {
      toast({
        title: 'Validation error',
        description: 'Please upload at least one photo',
        variant: 'destructive',
      });
      return;
    }
    
    // Add to list
    append(currentItem);
    
    // Reset for next item
    toast({
      title: 'Item added',
      description: `${currentItem.product.name} added to submission`,
    });
    
    setCurrentItem(null);
  };
  
  // Upload photos for an item
  const uploadPhotos = async (item: SubmissionItem, submissionId: string): Promise<string[]> => {
    const photoUrls: string[] = [];
    
    for (let i = 0; i < item.photos.length; i++) {
      const file = item.photos[i];
      
      // Generate standardized filename: PRODUCTCODE_CAPACITY_QUANTITYUN.ext
      const fileExt = file.name.split('.').pop();
      const fileName = `${item.product?.code}_${item.product?.capacity}_${item.quantity}UN_${i + 1}.${fileExt}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('breakage-photos')
        .upload(`submissions/${submissionId}/${fileName}`, file);
      
      if (error) {
        throw new Error(`Error uploading photo: ${error.message}`);
      }
      
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('breakage-photos')
        .getPublicUrl(`submissions/${submissionId}/${fileName}`);
      
      photoUrls.push(publicUrlData.publicUrl);
    }
    
    return photoUrls;
  };
  
  // Submit the form
  const onSubmit = async () => {
    if (items.length === 0) {
      toast({
        title: 'Validation error',
        description: 'Please add at least one item to your submission',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create submission record
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          user_id: user!.id,
          status: 'pending',
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (submissionError || !submission) {
        throw new Error(`Error creating submission: ${submissionError?.message || 'Unknown error'}`);
      }
      
      // Upload photos and create item records
      for (const item of items) {
        // Upload photos first
        const photoUrls = await uploadPhotos(item, submission.id);
        
        // Create item record
        const { error: itemError } = await supabase
          .from('items')
          .insert({
            submission_id: submission.id,
            product_id: item.productId,
            quantity: item.quantity,
            reason: item.reason,
            type: item.type,
            photos: photoUrls,
          });
        
        if (itemError) {
          throw new Error(`Error creating item: ${itemError.message}`);
        }
      }
      
      // Log activity
      await supabase.from('logs').insert({
        user_id: user!.id,
        action: 'create_submission',
        details: `Created submission with ${items.length} items`,
      });
      
      toast({
        title: 'Submission created',
        description: `Your submission with ${items.length} items has been created successfully`,
      });
      
      // Reset form
      reset({ items: [] });
      
      // Navigate to submission history
      navigate('/submissions/history');
    } catch (error: any) {
      toast({
        title: 'Error creating submission',
        description: error.message,
        variant: 'destructive',
      });
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
    }
  };
  
  // Confirm submission dialog
  const confirmSubmission = () => {
    setShowConfirmDialog(true);
  };
  
  // Clear all items dialog
  const confirmClear = () => {
    setShowClearDialog(true);
  };
  
  // Clear all items
  const clearItems = () => {
    // Revoke all object URLs
    items.forEach(item => {
      item.photoUrls.forEach(url => URL.revokeObjectURL(url));
    });
    
    reset({ items: [] });
    setShowClearDialog(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">New Submission</h1>
      </div>
      
      {/* Current Items List */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Items in this submission ({items.length})</span>
            {items.length > 0 && (
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={confirmClear}
                  className="text-red-500 border-red-200 hover:bg-red-50"
                >
                  <Trash size={14} className="mr-1" /> Clear All
                </Button>
                <Button 
                  size="sm"
                  onClick={confirmSubmission}
                  disabled={isSubmitting}
                  className="bg-company-primary hover:bg-company-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="mr-1 animate-spin" /> 
                      Submitting...
                    </>
                  ) : (
                    <>Finish Submission</>
                  )}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <p>No items added yet. Add items using the form below.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="border rounded-md p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <div className={`mr-2 inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          item.type === 'breakage' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.type === 'breakage' ? 'Breakage' : 'Exchange'}
                        </div>
                        <h3 className="font-medium">{item.product?.name}</h3>
                      </div>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-x-4">
                        <span>Code: {item.product?.code}</span>
                        <span>Capacity: {item.product?.capacity}ml</span>
                        <span>Quantity: {item.quantity}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-500">Reason: </span>
                        {item.reason}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex -space-x-2">
                        {item.photoUrls.slice(0, 3).map((url, i) => (
                          <div key={i} className="h-8 w-8 rounded-full border-2 border-white overflow-hidden">
                            <img src={url} alt={`Photo ${i+1}`} className="h-full w-full object-cover" />
                          </div>
                        ))}
                        {item.photoUrls.length > 3 && (
                          <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                            +{item.photoUrls.length - 3}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        
        {items.length > 0 && (
          <CardFooter className="flex justify-end border-t pt-4">
            <Button 
              onClick={confirmSubmission}
              disabled={isSubmitting}
              className="bg-company-primary hover:bg-company-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> 
                  Submitting...
                </>
              ) : (
                <>Finish Submission</>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
      
      {/* Add Item Form */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">
            {currentItem ? 'Add Item Details' : 'Add New Item'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!currentItem ? (
            <div className="flex justify-center py-6">
              <Button 
                onClick={createNewItem}
                className="bg-company-primary hover:bg-company-primary/90"
              >
                <Plus size={16} className="mr-2" /> Add New Item
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                {/* Type Selection */}
                <div className="space-y-2">
                  <Label>Type</Label>
                  <RadioGroup 
                    defaultValue={currentItem.type}
                    value={currentItem.type}
                    onValueChange={(value) => setCurrentItem({
                      ...currentItem,
                      type: value as 'breakage' | 'exchange'
                    })}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="breakage" id="breakage" />
                      <Label htmlFor="breakage" className="cursor-pointer">Breakage</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="exchange" id="exchange" />
                      <Label htmlFor="exchange" className="cursor-pointer">Exchange</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {/* Product Selection */}
                <div className="space-y-2">
                  <Label htmlFor="product">Product</Label>
                  <Popover open={isProductsOpen} onOpenChange={handleProductSelectorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={isProductsOpen}
                        className="w-full justify-between"
                      >
                        {currentItem.productId && currentItem.product
                          ? `${currentItem.product.name} (${currentItem.product.code})`
                          : "Select product..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search products..." />
                        <CommandEmpty>
                          {isProductsLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="ml-2">Loading products...</span>
                            </div>
                          ) : (
                            "No products found."
                          )}
                        </CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-y-auto">
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={`${product.name} ${product.code}`.toLowerCase()}
                              onSelect={() => handleProductSelect(product.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  currentItem.productId === product.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div>
                                <div>{product.name}</div>
                                <div className="text-xs text-gray-500">
                                  Code: {product.code} • Capacity: {product.capacity}ml
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={currentItem.quantity}
                    onChange={(e) => setCurrentItem({
                      ...currentItem,
                      quantity: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
                
                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={currentItem.reason}
                    onChange={(e) => setCurrentItem({
                      ...currentItem,
                      reason: e.target.value
                    })}
                    placeholder="Explain the reason for breakage or exchange..."
                    rows={3}
                  />
                </div>
                
                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Photos</Label>
                  <div
                    {...getRootProps()}
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 cursor-pointer text-center transition-colors",
                      isDragActive
                        ? "border-company-primary/50 bg-company-primary/5"
                        : "border-gray-300 hover:border-company-primary/50 hover:bg-gray-50"
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ImagePlus className="h-8 w-8 text-gray-400" />
                      <div className="text-sm text-gray-600">
                        <span className="font-medium text-company-primary">Click to upload</span> or drag and drop
                      </div>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, GIF up to 5MB
                      </p>
                    </div>
                  </div>
                  
                  {/* Photo Previews */}
                  {currentItem.photoUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {currentItem.photoUrls.map((url, index) => (
                        <div key={index} className="relative group rounded-md overflow-hidden border h-24 md:h-32">
                          <img src={url} alt={`Preview ${index}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removePhoto(index)}
                              className="text-white bg-red-500/80 hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={16} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Revoke all object URLs
                    currentItem.photoUrls.forEach(url => URL.revokeObjectURL(url));
                    setCurrentItem(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={addCurrentItemToList}
                  className="bg-company-primary hover:bg-company-primary/90"
                >
                  Add to Submission
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Confirm Submission Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to submit {items.length} item(s) for approval. This action cannot be undone.
              Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onSubmit}
              disabled={isSubmitting}
              className="bg-company-primary hover:bg-company-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> 
                  Submitting...
                </>
              ) : (
                'Confirm Submission'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Confirm Clear Items Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {items.length} item(s) from your current submission. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={clearItems}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NewSubmission;
