
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';
import { Currency, getUserSettings, db } from '@/lib/db';

interface GeneralSettingsProps {
  currencies: Currency[];
  defaultCurrency: string;
  darkMode: boolean;
  setDefaultCurrency: (currency: string) => void;
  setDarkMode: (enabled: boolean) => void;
}

export function GeneralSettings({
  currencies,
  defaultCurrency,
  darkMode,
  setDefaultCurrency,
  setDarkMode,
}: GeneralSettingsProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const handleSaveSettings = async () => {
    if (!currentUser?.id) return;
    
    try {
      // Get existing settings
      const settings = await getUserSettings(currentUser.id);
      
      if (settings.id) {
        // Update existing settings
        await db.settings.update(settings.id, {
          defaultCurrency,
          darkMode
        });
      } else {
        // Create new settings
        await db.settings.add({
          userId: currentUser.id,
          defaultCurrency,
          darkMode
        });
      }
      
      toast({
        title: 'Settings Saved',
        description: 'Your preferences have been updated',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>
          Customize your application preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="darkMode">Dark Mode</Label>
            <Switch
              id="darkMode"
              checked={darkMode}
              onCheckedChange={setDarkMode}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Enable dark mode for a better experience in low-light environments.
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="defaultCurrency">Default Currency</Label>
          <div className="flex gap-2">
            <select
              id="defaultCurrency"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={defaultCurrency}
              onChange={(e) => setDefaultCurrency(e.target.value)}
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <Button onClick={handleSaveSettings}>
          <Save className="mr-2 h-4 w-4" /> Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
