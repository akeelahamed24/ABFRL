import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X, AlertCircle, Package } from 'lucide-react';
import { Layout } from '@/components/layout';
import { ProductGrid } from '@/components/product';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { productAPI, categoryAPI } from '@/lib/api';

const Products = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const searchQuery = searchParams.get('search');
  
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 12,
    total_pages: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prevFiltersRef = useRef({
    selectedCategory: null as string | null,
    searchQuery: '',
    selectedOccasions: [] as string[],
    priceRange: [0, 5000] as [number, number],
    sortBy: 'newest'
  });

  // Define categories for the frontend
  const categories = [
    { 
      id: 'women', 
      name: 'Women', 
      subcategories: [
        { id: 'dresses', name: 'Dresses' },
        { id: 'tops-blouses', name: 'Tops & Blouses' },
        { id: 'bottoms', name: 'Bottoms' },
        { id: 'outerwear', name: 'Outerwear' }
      ]
    },
    { 
      id: 'men', 
      name: 'Men', 
      subcategories: [
        { id: 'shirts', name: 'Shirts' },
        { id: 'pants', name: 'Pants' },
        { id: 'outerwear', name: 'Outerwear' }
      ]
    },
    { 
      id: 'kids', 
      name: 'Kids', 
      subcategories: [
        { id: 'dresses', name: 'Dresses' },
        { id: 'tops', name: 'Tops' },
        { id: 'bottoms', name: 'Bottoms' }
      ]
    }
  ];

  const occasions = [
    { id: 'wedding', name: 'Wedding' },
    { id: 'party', name: 'Party' },
    { id: 'casual', name: 'Casual' },
    { id: 'formal', name: 'Formal' },
    { id: 'business', name: 'Business' }
  ];

  // Mapping from frontend category IDs to backend category strings
  const categoryMapping: { [key: string]: string } = {
    // Main categories
    'women': 'women',
    'men': 'men',
    'kids': 'kids',

    // Women's subcategories
    'dresses': 'women-dresses',
    'tops-blouses': 'women-tops',
    'bottoms': 'women-bottoms',
    'outerwear': 'women-outerwear',

    // Men's subcategories
    'shirts': 'men-shirts',
    'pants': 'men-pants',
    'men-outerwear': 'men-outerwear',

    // Kids' subcategories
    'kids-dresses': 'kids-girls',
    'kids-tops': 'kids-girls',
    'kids-bottoms': 'kids-girls',
    'kids-outerwear': 'kids-girls'
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedOccasions([]);
    setPriceRange([0, 5000]);
    setSortBy('newest');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const filtersChanged = prevFiltersRef.current.selectedCategory !== selectedCategory ||
                              prevFiltersRef.current.searchQuery !== searchQuery ||
                              JSON.stringify(prevFiltersRef.current.selectedOccasions) !== JSON.stringify(selectedOccasions) ||
                              JSON.stringify(prevFiltersRef.current.priceRange) !== JSON.stringify(priceRange) ||
                              prevFiltersRef.current.sortBy !== sortBy;

        // Update ref
        prevFiltersRef.current = {
          selectedCategory,
          searchQuery: searchQuery || '',
          selectedOccasions: [...selectedOccasions],
          priceRange: [...priceRange],
          sortBy
        };

        const params: any = {
          page: filtersChanged ? 1 : pagination.page,
          limit: pagination.limit
        };

        // Handle search
        if (searchQuery && searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        // Handle category
        if (selectedCategory) {
          // Use the mapping to get the correct backend category
          const backendCategory = categoryMapping[selectedCategory];
          if (backendCategory) {
            params.category = backendCategory;
          }
        }

        // Handle occasions
        if (selectedOccasions.length > 0) {
          // If multiple occasions selected, use the first one for API
          params.occasion = selectedOccasions[0];
        }

        // Handle price range
        if (priceRange[0] > 0) {
          params.min_price = priceRange[0];
        }
        if (priceRange[1] < 5000) {
          params.max_price = priceRange[1];
        }

        // Handle sorting
        let sortParam = '';
        switch (sortBy) {
          case 'price-low': sortParam = 'price'; break;
          case 'price-high': sortParam = '-price'; break;
          case 'featured': params.featured = true; break;
          case 'newest': sortParam = '-created_at'; break;
          case 'popular': sortParam = '-popularity'; break;
        }
        if (sortParam) params.sort = sortParam;

        console.log('Fetching products with params:', params);

        const response = await productAPI.getAll(params);

        // Handle different response formats
        let productsData = [];
        let total = 0;
        let page = 1;
        let limit = pagination.limit;
        let total_pages = 0;

        if (response && typeof response === 'object') {
          // Check for paginated response format
          if (response.products && Array.isArray(response.products)) {
            productsData = response.products;
            total = response.total || response.products.length;
            page = response.page || 1;
            limit = response.limit || pagination.limit;
            total_pages = response.total_pages || Math.ceil(total / limit);
          } 
          // Check if response is already an array
          else if (Array.isArray(response)) {
            productsData = response;
            total = response.length;
            total_pages = Math.ceil(total / limit);
          }
          // Check for data property
          else if (response.data && Array.isArray(response.data)) {
            productsData = response.data;
            total = response.total || response.data.length;
            page = response.page || 1;
            limit = response.limit || pagination.limit;
            total_pages = response.total_pages || Math.ceil(total / limit);
          }
        }

        // Apply additional frontend filtering if needed
        let filteredProducts = productsData;
        
        // Ensure all products have required fields
        filteredProducts = filteredProducts.map((product: any) => ({
          ...product,
          id: product.id || product._id || Math.random().toString(36).substr(2, 9),
          name: product.name || product.product_name || 'Unnamed Product',
          price: product.price || product.unit_price || 0,
          image: product.image || product.primary_image || '/placeholder-image.jpg',
          category: product.category || product.dress_category || 'uncategorized'
        }));

        setProducts(filteredProducts);
        setPagination(prev => ({
          ...prev,
          total,
          page: filtersChanged ? 1 : page,
          limit,
          total_pages
        }));

      } catch (err: any) {
        console.error('Failed to fetch products:', err);
        setError(err.message || 'Failed to load products. Please try again.');
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, searchQuery, selectedOccasions, priceRange, sortBy, pagination.page]);

  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    
    let result = [...products];
    
    // Apply client-side filtering for multiple occasions
    if (selectedOccasions.length > 0) {
      result = result.filter(p => p.occasion && selectedOccasions.includes(p.occasion));
    }
    
    // Apply price filtering (in case API didn't handle it properly)
    result = result.filter(p => {
      const price = p.price || p.unit_price || 0;
      return price >= priceRange[0] && price <= priceRange[1];
    });
    
    // Note: Main category filtering is now handled by the backend
    // Only apply additional client-side filtering if needed
    
    // Apply sorting
    switch (sortBy) {
      case 'price-low': 
        result.sort((a, b) => (a.price || 0) - (b.price || 0)); 
        break;
      case 'price-high': 
        result.sort((a, b) => (b.price || 0) - (a.price || 0)); 
        break;
      case 'featured': 
        result.sort((a, b) => (b.featured_dress ? 1 : 0) - (a.featured_dress ? 1 : 0)); 
        break;
      case 'newest': 
        result.sort((a, b) => 
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        ); 
        break;
      case 'popular':
        result.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        break;
    }
    
    return result;
  }, [products, selectedOccasions, priceRange, sortBy]);

  const getCategoryTitle = () => {
    if (searchQuery) return `Search: "${searchQuery}"`;
    if (!selectedCategory) return 'All Products';
    
    // Check main categories
    const mainCat = categories.find(c => c.id === selectedCategory);
    if (mainCat) return mainCat.name;
    
    // Check subcategories
    for (const cat of categories) {
      const sub = cat.subcategories.find(s => s.id === selectedCategory);
      if (sub) return `${cat.name} - ${sub.name}`;
    }
    
    return 'Products';
  };

  const FilterContent = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Filters</h3>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={clearFilters}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      </div>
      
      {/* Category Filter */}
      <div>
        <h4 className="font-medium mb-3 text-sm">Category</h4>
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={() => setSelectedCategory(null)}
            className={`w-full justify-start text-sm px-2 ${!selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            All Products
          </Button>
          {categories.map((cat) => (
            <div key={cat.id} className="space-y-1">
              <Button
                variant="ghost"
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full justify-start text-sm px-2 ${selectedCategory === cat.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {cat.name}
              </Button>
              <div className="ml-3 space-y-1">
                {cat.subcategories.map((sub) => (
                  <Button
                    key={sub.id}
                    variant="ghost"
                    onClick={() => setSelectedCategory(sub.id)}
                    className={`w-full justify-start text-xs px-2 ${selectedCategory === sub.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {sub.name}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Price Range Filter */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-sm">Price Range</h4>
          <span className="text-xs text-muted-foreground">
            ₹{priceRange[0]} - ₹{priceRange[1]}
          </span>
        </div>
        <Slider
          value={priceRange}
          min={0}
          max={5000}
          step={100}
          onValueChange={(value) => {
            setPriceRange(value as [number, number]);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          className="mb-4"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="min-price" className="text-xs">Min</Label>
            <Input
              id="min-price"
              type="number"
              value={priceRange[0]}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setPriceRange([value, priceRange[1]]);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="h-8 text-sm"
              min={0}
              max={priceRange[1]}
            />
          </div>
          <div>
            <Label htmlFor="max-price" className="text-xs">Max</Label>
            <Input
              id="max-price"
              type="number"
              value={priceRange[1]}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 5000;
                setPriceRange([priceRange[0], value]);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="h-8 text-sm"
              min={priceRange[0]}
              max={5000}
            />
          </div>
        </div>
      </div>
      
      {/* Occasion Filter */}
      <div>
        <h4 className="font-medium mb-3 text-sm">Occasion</h4>
        <div className="space-y-2">
          {occasions.map((occ) => (
            <div key={occ.id} className="flex items-center space-x-2">
              <Checkbox
                id={`occasion-${occ.id}`}
                checked={selectedOccasions.includes(occ.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedOccasions(prev => [...prev, occ.id]);
                  } else {
                    setSelectedOccasions(prev => prev.filter(o => o !== occ.id));
                  }
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />
              <Label
                htmlFor={`occasion-${occ.id}`}
                className="text-sm font-normal cursor-pointer"
              >
                {occ.name}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Active Filters */}
      {(selectedCategory || selectedOccasions.length > 0 || priceRange[0] > 0 || priceRange[1] < 5000) && (
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2 text-sm">Active Filters</h4>
          <div className="flex flex-wrap gap-2">
            {selectedCategory && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {getCategoryTitle()}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedCategory(null)}
                />
              </Badge>
            )}
            {selectedOccasions.map(occasion => (
              <Badge key={occasion} variant="secondary" className="flex items-center gap-1">
                {occasions.find(o => o.id === occasion)?.name}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setSelectedOccasions(prev => prev.filter(o => o !== occasion))}
                />
              </Badge>
            ))}
            {(priceRange[0] > 0 || priceRange[1] < 5000) && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Price: ₹{priceRange[0]} - ₹{priceRange[1]}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => setPriceRange([0, 5000])}
                />
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Add Badge component if not imported
  const Badge = ({ children, variant = 'default', className = '', ...props }: any) => (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        variant === 'secondary' 
          ? 'bg-secondary text-secondary-foreground' 
          : 'bg-primary text-primary-foreground'
      } ${className}`}
      {...props}
    >
      {children}
    </span>
  );

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="container py-6 md:py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="font-serif text-2xl md:text-3xl lg:text-4xl mb-2">{getCategoryTitle()}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {isLoading ? 'Loading...' : `${pagination.total} products found`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest Arrivals</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="md:hidden">
                    <Filter className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FilterContent />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Desktop Filters */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <FilterContent />
              </div>
            </aside>
            
            {/* Main Content */}
            <div className="flex-1">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-gray-200 dark:bg-gray-800 aspect-square rounded-lg mb-4"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-16">
                  <div className="mb-4">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <p className="text-destructive mb-4">{error}</p>
                  </div>
                  <Button onClick={() => window.location.reload()}>Try Again</Button>
                </div>
              ) : filteredProducts.length > 0 ? (
                <>
                  {/* Mobile Active Filters */}
                  <div className="lg:hidden mb-6">
                    <div className="flex flex-wrap gap-2">
                      {selectedCategory && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {getCategoryTitle()}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => setSelectedCategory(null)}
                          />
                        </Badge>
                      )}
                      {selectedOccasions.map(occasion => (
                        <Badge key={occasion} variant="secondary" className="flex items-center gap-1">
                          {occasions.find(o => o.id === occasion)?.name}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => setSelectedOccasions(prev => prev.filter(o => o !== occasion))}
                          />
                        </Badge>
                      ))}
                      {(priceRange[0] > 0 || priceRange[1] < 5000) && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          Price: ₹{priceRange[0]} - ₹{priceRange[1]}
                          <X 
                            className="h-3 w-3 cursor-pointer" 
                            onClick={() => setPriceRange([0, 5000])}
                          />
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Product Grid */}
                  <ProductGrid products={filteredProducts} columns={3} />
                  
                  {/* Pagination */}
                  {pagination.total_pages > 1 && (
                    <div className="mt-12">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page - 1)}
                          disabled={pagination.page <= 1}
                          className="gap-2"
                        >
                          ← Previous
                        </Button>

                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                            let pageNum;
                            if (pagination.total_pages <= 5) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (pagination.page >= pagination.total_pages - 2) {
                              pageNum = pagination.total_pages - 4 + i;
                            } else {
                              pageNum = pagination.page - 2 + i;
                            }

                            return (
                              <Button
                                key={pageNum}
                                variant={pagination.page === pageNum ? "default" : "outline"}
                                size="sm"
                                className="w-10 h-10"
                                onClick={() => handlePageChange(pageNum)}
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(pagination.page + 1)}
                          disabled={pagination.page >= pagination.total_pages}
                          className="gap-2"
                        >
                          Next →
                        </Button>
                      </div>
                      
                      {/* Pagination info */}
                      <div className="text-center text-sm text-muted-foreground">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} products
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16">
                  <div className="mb-6">
                    <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No products found</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Try adjusting your filters or search term to find what you're looking for.
                    </p>
                  </div>
                  <Button onClick={clearFilters}>Clear All Filters</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Products;