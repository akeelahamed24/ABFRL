import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, Building, Globe, Hash, Award, ArrowLeft, Save, Edit2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const Profile = () => {
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    city: user?.city || '',
    state: user?.state || '',
    country: user?.country || '',
    postal_code: user?.postal_code || '',
  });

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSave = () => {
    // Mock save - in real app this would call an API
    setIsEditing(false);
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved successfully.",
    });
  };

  const handleCancel = () => {
    // Reset form data
    setFormData({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      city: user?.city || '',
      state: user?.state || '',
      country: user?.country || '',
      postal_code: user?.postal_code || '',
    });
    setIsEditing(false);
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        {/* Back Link */}
        <Link 
          to="/" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">My Profile</h1>
            <p className="text-muted-foreground">
              Manage your account information and preferences
            </p>
          </div>
          {!isEditing ? (
            <Button 
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-brand-red via-brand-orange to-gold hover:from-brand-red-dark hover:via-brand-orange-dark hover:to-gold-dark text-white"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                className="bg-gradient-to-r from-brand-red via-brand-orange to-gold hover:from-brand-red-dark hover:via-brand-orange-dark hover:to-gold-dark text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {/* Profile Header with Avatar */}
          <div className="brand-gradient p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-background/20 backdrop-blur-sm flex items-center justify-center border-2 border-background/30">
                <User className="h-10 w-10 md:h-12 md:w-12 text-white" />
              </div>
              <div className="text-white">
                <h2 className="font-serif text-2xl md:text-3xl font-bold">
                  {user?.first_name || 'User'} {user?.last_name || ''}
                </h2>
                <p className="text-white/80 text-sm">{user?.email}</p>
                {user?.loyalty_score !== undefined && user.loyalty_score > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <Award className="h-4 w-4" />
                    <span className="text-sm">{user.loyalty_score} Loyalty Points</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="p-6 md:p-8">
            {/* Personal Information */}
            <div className="mb-8">
              <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="h-5 w-5 text-brand-orange" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={cn(!isEditing && "bg-muted")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={cn(!isEditing && "bg-muted")}
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Contact Information */}
            <div className="mb-8">
              <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-brand-orange" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={true}
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="+91 98765 43210"
                    className={cn(!isEditing && "bg-muted")}
                  />
                </div>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Address Information */}
            <div>
              <h3 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-brand-orange" />
                Address Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Enter your street address"
                    rows={2}
                    className={cn(!isEditing && "bg-muted")}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Mumbai"
                      className={cn(!isEditing && "bg-muted")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Maharashtra"
                      className={cn(!isEditing && "bg-muted")}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="India"
                      className={cn(!isEditing && "bg-muted")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="400001"
                      className={cn(!isEditing && "bg-muted")}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div className="bg-card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-serif font-bold text-brand-orange">{user?.loyalty_score || 0}</div>
            <div className="text-sm text-muted-foreground">Loyalty Points</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-serif font-bold text-brand-orange">0</div>
            <div className="text-sm text-muted-foreground">Orders</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-serif font-bold text-brand-orange">0</div>
            <div className="text-sm text-muted-foreground">Wishlist Items</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 text-center">
            <div className="text-2xl font-serif font-bold text-brand-orange">
              {user?.is_active ? 'Active' : 'Inactive'}
            </div>
            <div className="text-sm text-muted-foreground">Account Status</div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/wishlist"
            className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:border-brand-orange/50 transition-colors group"
          >
            <div className="h-10 w-10 rounded-full bg-brand-orange/10 flex items-center justify-center group-hover:bg-brand-orange/20 transition-colors">
              <Award className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <div className="font-medium">My Wishlist</div>
              <div className="text-sm text-muted-foreground">View saved items</div>
            </div>
          </Link>
          <Link 
            to="/products"
            className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:border-brand-orange/50 transition-colors group"
          >
            <div className="h-10 w-10 rounded-full bg-brand-orange/10 flex items-center justify-center group-hover:bg-brand-orange/20 transition-colors">
              <Building className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <div className="font-medium">Shop Now</div>
              <div className="text-sm text-muted-foreground">Browse collections</div>
            </div>
          </Link>
          <Link 
            to="/"
            className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border hover:border-brand-orange/50 transition-colors group"
          >
            <div className="h-10 w-10 rounded-full bg-brand-orange/10 flex items-center justify-center group-hover:bg-brand-orange/20 transition-colors">
              <Globe className="h-5 w-5 text-brand-orange" />
            </div>
            <div>
              <div className="font-medium">Help Center</div>
              <div className="text-sm text-muted-foreground">Get support</div>
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;