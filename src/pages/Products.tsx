import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X } from 'lucide-react';
import { Layout } from '@/components/layout';
import { ProductGrid } from '@/components/product';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { mockProducts, categories, occasions, sizes, colors } from '@/data/mockData';

const Products = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category');
  const searchQuery = searchParams.get('search');
  
  const [sortBy, setSortBy] = useState('newest');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000]);

  const filteredProducts = useMemo(() => {
    let result = [...mockProducts];
    
    if (searchQuery) {
      result = result.filter(p => 
        p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (selectedCategory) {
      if (['women', 'men', 'kids'].includes(selectedCategory)) {
        result = result.filter(p => p.dress_category.startsWith(selectedCategory));
      } else {
        result = result.filter(p => p.dress_category === selectedCategory);
      }
    }
    
    if (selectedOccasions.length > 0) {
      result = result.filter(p => p.occasion && selectedOccasions.includes(p.occasion));
    }
    
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    
    switch (sortBy) {
      case 'price-low': result.sort((a, b) => a.price - b.price); break;
      case 'price-high': result.sort((a, b) => b.price - a.price); break;
      case 'featured': result.sort((a, b) => (b.featured_dress ? 1 : 0) - (a.featured_dress ? 1 : 0)); break;
      default: result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return result;
  }, [selectedCategory, selectedOccasions, priceRange, sortBy, searchQuery]);

  const getCategoryTitle = () => {
    if (searchQuery) return `Search: "${searchQuery}"`;
    if (!selectedCategory) return 'All Products';
    const cat = categories.find(c => c.id === selectedCategory);
    if (cat) return cat.name;
    for (const c of categories) {
      const sub = c.subcategories.find(s => s.id === selectedCategory);
      if (sub) return sub.name;
    }
    return 'Products';
  };

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-3">Category</h4>
        <div className="space-y-2">
          <button onClick={() => setSelectedCategory(null)} className={`block text-sm ${!selectedCategory ? 'text-gold font-medium' : 'text-muted-foreground hover:text-foreground'}`}>All Products</button>
          {categories.map((cat) => (
            <div key={cat.id}>
              <button onClick={() => setSelectedCategory(cat.id)} className={`block text-sm ${selectedCategory === cat.id ? 'text-gold font-medium' : 'text-muted-foreground hover:text-foreground'}`}>{cat.name}</button>
              <div className="ml-3 mt-1 space-y-1">
                {cat.subcategories.map((sub) => (
                  <button key={sub.id} onClick={() => setSelectedCategory(sub.id)} className={`block text-xs ${selectedCategory === sub.id ? 'text-gold font-medium' : 'text-muted-foreground hover:text-foreground'}`}>{sub.name}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-medium mb-3">Occasion</h4>
        <div className="space-y-2">
          {occasions.map((occ) => (
            <label key={occ.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={selectedOccasions.includes(occ.id)} onCheckedChange={(checked) => setSelectedOccasions(prev => checked ? [...prev, occ.id] : prev.filter(o => o !== occ.id))} />
              {occ.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl mb-2">{getCategoryTitle()}</h1>
            <p className="text-muted-foreground">{filteredProducts.length} products</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="featured">Featured</SelectItem>
              </SelectContent>
            </Select>
            <Sheet>
              <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden"><Filter className="h-4 w-4" /></Button></SheetTrigger>
              <SheetContent><SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader><div className="mt-6"><FilterContent /></div></SheetContent>
            </Sheet>
          </div>
        </div>
        <div className="flex gap-12">
          <aside className="hidden md:block w-56 flex-shrink-0"><FilterContent /></aside>
          <div className="flex-1">
            {filteredProducts.length > 0 ? <ProductGrid products={filteredProducts} columns={3} /> : (
              <div className="text-center py-16">
                <p className="text-muted-foreground mb-4">No products found</p>
                <Button onClick={() => { setSelectedCategory(null); setSelectedOccasions([]); }}>Clear Filters</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Products;
