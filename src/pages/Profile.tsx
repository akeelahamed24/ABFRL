import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { User, ArrowLeft, Save, Edit2, MessageCircleMore, Link2, Unlink } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const Profile = () => {
  const { user, isAuthenticated, updateProfile, updateWhatsAppConnection, isLoading } = useAuth();
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
  const [whatsAppPhone, setWhatsAppPhone] = useState(user?.whatsapp_connection?.phone_number || user?.phone || '');
  const [whatsAppOptIn, setWhatsAppOptIn] = useState(user?.whatsapp_connection?.opt_in ?? true);

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

  const handleWhatsAppConnection = async (connected: boolean) => {
    const success = await updateWhatsAppConnection({
      phone_number: whatsAppPhone,
      connected,
      opt_in: whatsAppOptIn,
    });

    if (success) {
      toast({
        title: connected ? 'WhatsApp connected' : 'WhatsApp disconnected',
        description: connected
          ? 'Simulated OpenClaw notifications are now enabled for your profile.'
          : 'WhatsApp notifications have been turned off.',
      });
      return;
    }

    toast({
      title: 'WhatsApp update failed',
      description: 'We could not update your WhatsApp simulation settings.',
      variant: 'destructive',
    });
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

        <div className="bg-card rounded-lg border border-border overflow-hidden mt-8">
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
                  <MessageCircleMore className="h-5 w-5 text-brand-orange" />
                  WhatsApp Simulation
                </h2>
                <p className="text-muted-foreground mt-1">
                  Connect your profile to simulated OpenClaw notifications for order, payment, and delivery updates.
                </p>
              </div>
              <div className={cn(
                'rounded-full px-3 py-1 text-xs font-medium',
                user?.whatsapp_connection?.status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
              )}>
                {user?.whatsapp_connection?.status === 'connected' ? 'Connected' : 'Disconnected'}
              </div>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input
                value={whatsAppPhone}
                onChange={(e) => setWhatsAppPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-4">
              <div>
                <Label className="block mb-1">Receive automated WhatsApp updates</Label>
                <p className="text-sm text-muted-foreground">
                  Enables simulated messages for order confirmation, payment status, shipping, out-for-delivery, and delivery completion.
                </p>
              </div>
              <Switch checked={whatsAppOptIn} onCheckedChange={setWhatsAppOptIn} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handleWhatsAppConnection(true)}
                disabled={isLoading || !whatsAppPhone.trim()}
                className="bg-gradient-to-r from-brand-red via-brand-orange to-gold text-white"
              >
                <Link2 className="h-4 w-4 mr-2" /> Connect via OpenClaw
              </Button>
              <Button variant="outline" onClick={() => void handleWhatsAppConnection(false)} disabled={isLoading}>
                <Unlink className="h-4 w-4 mr-2" /> Disconnect
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
