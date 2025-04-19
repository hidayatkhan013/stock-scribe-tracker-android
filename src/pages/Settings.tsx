
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { db, Currency, getUserSettings } from '@/lib/db';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { CurrencySettings } from '@/components/settings/CurrencySettings';
import { AccountSettings } from '@/components/settings/AccountSettings';

const Settings = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Load currencies
        const allCurrencies = await db.currencies.toArray();
        setCurrencies(allCurrencies);
        
        // Check for saved settings using the getUserSettings helper
        const settings = await getUserSettings(currentUser.id);
        if (settings?.defaultCurrency) {
          setDefaultCurrency(settings.defaultCurrency);
        }
        if (settings?.darkMode !== undefined) {
          setDarkMode(settings.darkMode);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [toast, currentUser]);

  if (isLoading) {
    return (
      <AppLayout title="Settings">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="general" className="max-w-4xl mx-auto">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <GeneralSettings
            currencies={currencies}
            defaultCurrency={defaultCurrency}
            darkMode={darkMode}
            setDefaultCurrency={setDefaultCurrency}
            setDarkMode={setDarkMode}
          />
        </TabsContent>
        
        <TabsContent value="currencies">
          <CurrencySettings
            currencies={currencies}
            setCurrencies={setCurrencies}
          />
        </TabsContent>
        
        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Settings;
