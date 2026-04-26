import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { User, Mail, Phone, MapPin, ArrowLeft, Save, Edit2, Award, Zap } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LoyaltyInfo {
  loyalty_score: number;
  tier: string;
  tier_discount: number;
  points_value: number;
  next_tier?: string;
  points_to_next_tier: number;
}

const getTierBadgeColor = (tier: string) => {
  switch(tier) {
    case 'Platinum': return 'from-purple-600 to-purple-400';
    case 'Gold': return 'from-yellow-600 to-yellow-400';
    case 'Silver': return 'from-gray-400 to-gray-300';
    default: return 'from-orange-600 to-orange-400';
  }
};

const Profile = () => {
  const { user, isAuthenticated, updateProfile, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
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

  useEffect(() => {
    if (user?.id) {
      fetchLoyaltyInfo();
    }
  }, [user?.id]);

  const fetchLoyaltyInfo = async () => {
    if (!user?.id) return;
    setLoyaltyLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/${user.id}/loyalty`);
      if (response.ok) {
        const data = await response.json();
        setLoyaltyInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch loyalty info:', error);
    } finally {
      setLoyaltyLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    const success = await updateProfile({
      phone: formData.phone,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      postal_code: formData.postal_code,
    });

    if (success) {
      setIsEditing(false);
      toast({ title: "Profile updated", description: "Your profile has been saved." });
      return;
    }

    toast({ title: "Update failed", description: "Unable to save your profile.", variant: "destructive" });
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-4xl">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">My Profile</h1>
            <p className="text-muted-foreground">Manage your account information</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="bg-gradient-to-r from-brand-red via-brand-orange to-gold text-white">
              <Edit2 className="h-4 w-4 mr-2" /> Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={isLoading} className="bg-gradient-to-r from-brand-red via-brand-orange to-gold text-white">
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="brand-gradient p-6 md:p-8">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-background/20 flex items-center justify-center border-2 border-background/30">
                <User className="h-10 w-10 text-white" />
              </div>
              <div className="text-white">
                <h2 className="font-serif text-2xl font-bold">{user?.first_name || 'User'} {user?.last_name || ''}</h2>
                <p className="text-white/80 text-sm">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input name="first_name" value={formData.first_name} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input name="last_name" value={formData.last_name} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" value={formData.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea name="address" value={formData.address} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input name="city" value={formData.city} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input name="state" value={formData.state} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input name="postal_code" value={formData.postal_code} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input name="country" value={formData.country} onChange={handleChange} disabled={!isEditing} className={cn(!isEditing && "bg-muted")} />
            </div>
          </div>
        </div>

        {/* Loyalty Section */}
        <div className="mt-8">
          <h3 className="font-serif text-2xl font-bold mb-4">✨ Loyalty & Rewards</h3>
          {loyaltyLoading ? (
            <div className="bg-card rounded-lg border border-border p-6 text-center text-muted-foreground">
              Loading loyalty information...
            </div>
          ) : loyaltyInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tier Badge */}
              <div className={`bg-gradient-to-r ${getTierBadgeColor(loyaltyInfo.tier)} rounded-lg p-6 text-white shadow-lg`}>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5" />
                  <span className="text-sm font-semibold">CURRENT TIER</span>
                </div>
                <h4 className="font-serif text-3xl font-bold mb-1">{loyaltyInfo.tier}</h4>
                <p className="text-sm opacity-90">{loyaltyInfo.tier_discount}% discount on all purchases</p>
              </div>

              {/* Points Info */}
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm font-semibold text-muted-foreground">LOYALTY POINTS</span>
                </div>
                <h4 className="font-serif text-3xl font-bold mb-1">{loyaltyInfo.loyalty_score}</h4>
                <p className="text-sm text-muted-foreground">Worth ${loyaltyInfo.points_value}</p>
                <p className="text-xs text-muted-foreground mt-2">1 point = $0.01</p>
              </div>

              {/* Next Tier */}
              <div className="bg-card rounded-lg border border-border p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-semibold text-muted-foreground">NEXT TIER</span>
                </div>
                {loyaltyInfo.next_tier ? (
                  <>
                    <h4 className="font-serif text-xl font-bold mb-1">{loyaltyInfo.next_tier}</h4>
                    <p className="text-sm text-muted-foreground">{loyaltyInfo.points_to_next_tier} points away</p>
                    <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-brand-red to-gold h-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, 100 - (loyaltyInfo.points_to_next_tier / 100) * 100))}%`,
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="font-serif text-xl font-bold mb-1">Max Tier!</h4>
                    <p className="text-sm text-muted-foreground">You're at the highest tier</p>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
