
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash, Search } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  code: string;
  capacity: number;
}

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    capacity: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
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
        title: "Error fetching products",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const openNewProductDialog = () => {
    setCurrentProduct(null);
    setFormData({
      name: '',
      code: '',
      capacity: '',
    });
    setIsProductDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name,
      code: product.code,
      capacity: product.capacity.toString(),
    });
    setIsProductDialogOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setCurrentProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    try {
      // Form validation
      if (!formData.name.trim()) {
        toast({
          title: "Validation Error",
          description: "Product name is required",
          variant: "destructive",
        });
        return;
      }

      if (!formData.code.trim()) {
        toast({
          title: "Validation Error",
          description: "Product code is required",
          variant: "destructive",
        });
        return;
      }

      if (!formData.capacity.trim() || isNaN(Number(formData.capacity)) || Number(formData.capacity) <= 0) {
        toast({
          title: "Validation Error",
          description: "Product capacity must be a positive number",
          variant: "destructive",
        });
        return;
      }

      const productData = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        capacity: parseInt(formData.capacity),
      };

      if (currentProduct) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', currentProduct.id);

        if (error) throw error;

        toast({
          title: "Product updated",
          description: `${productData.name} has been updated successfully`,
        });
      } else {
        // Check for duplicate code
        const { data: existingProduct } = await supabase
          .from('products')
          .select('code')
          .eq('code', productData.code)
          .single();

        if (existingProduct) {
          toast({
            title: "Validation Error",
            description: "Product code already exists",
            variant: "destructive",
          });
          return;
        }

        // Create new product
        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) throw error;

        toast({
          title: "Product added",
          description: `${productData.name} has been added successfully`,
        });
      }

      // Close dialog and refresh products
      setIsProductDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error saving product",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async () => {
    try {
      if (!currentProduct) return;

      // Check if product is being used in any submissions
      const { count } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', currentProduct.id);

      if (count && count > 0) {
        toast({
          title: "Cannot delete product",
          description: "This product is being used in submissions and cannot be deleted",
          variant: "destructive",
        });
        setIsDeleteDialogOpen(false);
        return;
      }

      // Delete product
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', currentProduct.id);

      if (error) throw error;

      toast({
        title: "Product deleted",
        description: `${currentProduct.name} has been deleted successfully`,
      });

      // Close dialog and refresh products
      setIsDeleteDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Product Management</h1>
        <Button 
          onClick={openNewProductDialog}
          className="bg-company-primary hover:bg-company-primary/90"
        >
          <Plus size={16} className="mr-2" /> Add Product
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search products by name or code..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Capacity (ml)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-company-primary"></div>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-6">
                  {searchTerm ? "No products found matching your search" : "No products found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.code}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.capacity}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(product)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(product)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
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

      {/* Add/Edit Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                placeholder="Enter product name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Product Code</Label>
              <Input
                id="code"
                name="code"
                value={formData.code}
                onChange={handleFormChange}
                placeholder="Enter product code"
                className="uppercase"
                disabled={!!currentProduct} // Prevent editing code for existing products
              />
              {!currentProduct && (
                <p className="text-xs text-gray-500">
                  Once created, product codes cannot be changed
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity (ml)</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                value={formData.capacity}
                onChange={handleFormChange}
                placeholder="Enter capacity in ml"
                min="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveProduct}
              className="bg-company-primary hover:bg-company-primary/90"
            >
              {currentProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The product will be permanently deleted from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProduct}
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

export default Products;
