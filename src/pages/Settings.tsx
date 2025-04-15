
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, Currency } from '@/lib/db';
import { AlertCircle, RefreshCw, Plus, Save, BadgeIndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';

const Settings = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [darkMode, setDarkMode] = useState(false);

  // New currency state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState('');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [isPKRAdded, setIsPKRAdded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load currencies
        const allCurrencies = await db.currencies.toArray();
        setCurrencies(allCurrencies);
        
        // Check if PKR already exists
        const pkrExists = allCurrencies.some(c => c.code === 'PKR');
        setIsPKRAdded(pkrExists);
        
        // Check for saved settings
        const settings = await db.settings.where('userId').equals(currentUser?.id || '').first();
        if (settings?.defaultCurrency) {
          setDefaultCurrency(settings.defaultCurrency);
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
  
  const handleAddPKR = async () => {
    if (isPKRAdded) {
      toast({
        title: 'Currency Already Exists',
        description: 'Pakistani Rupee (PKR) is already in your currencies list',
      });
      return;
    }
    
    setIsAddingCurrency(true);
    try {
      const pkrCurrency: Currency = {
        code: 'PKR',
        name: 'Pakistani Rupee',
        symbol: '₨',
        exchangeRate: 278.5, // Example rate as of April 2025
        lastUpdated: new Date(),
      };

      // Add to database
      await db.currencies.add(pkrCurrency);

      // Update local state
      setCurrencies([...currencies, pkrCurrency]);
      setIsPKRAdded(true);

      toast({
        title: 'Currency Added',
        description: 'Pakistani Rupee (PKR) has been added successfully',
      });
    } catch (error) {
      console.error('Error adding PKR:', error);
      toast({
        title: 'Error',
        description: 'Failed to add Pakistani Rupee',
        variant: 'destructive',
      });
    } finally {
      setIsAddingCurrency(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Get existing settings or create new entry
      const existingSettings = await db.settings.where('userId').equals(currentUser?.id || '').first();
      
      if (existingSettings) {
        // Update existing settings
        await db.settings.update(existingSettings.id!, {
          defaultCurrency,
          darkMode
        });
      } else {
        // Create new settings
        await db.settings.add({
          userId: currentUser?.id,
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

  const handleAddCurrency = async () => {
    if (!newCode || !newName || !newSymbol || !newRate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Check if currency already exists
    const exists = currencies.some(c => c.code === newCode);
    if (exists) {
      toast({
        title: 'Error',
        description: `Currency code ${newCode} already exists`,
        variant: 'destructive',
      });
      return;
    }

    const rateValue = parseFloat(newRate);
    if (isNaN(rateValue) || rateValue <= 0) {
      toast({
        title: 'Error',
        description: 'Exchange rate must be a positive number',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCurrency(true);
    try {
      const newCurrency: Currency = {
        code: newCode.toUpperCase(),
        name: newName,
        symbol: newSymbol,
        exchangeRate: rateValue,
        lastUpdated: new Date(),
      };

      // Add to database
      await db.currencies.add(newCurrency);

      // Update local state
      setCurrencies([...currencies, newCurrency]);

      // Reset form
      setNewCode('');
      setNewName('');
      setNewSymbol('');
      setNewRate('');

      toast({
        title: 'Currency Added',
        description: `${newCode.toUpperCase()} has been added successfully`,
      });
    } catch (error) {
      console.error('Error adding currency:', error);
      toast({
        title: 'Error',
        description: 'Failed to add currency',
        variant: 'destructive',
      });
    } finally {
      setIsAddingCurrency(false);
    }
  };

  const handleUpdateRates = () => {
    toast({
      title: 'Coming Soon',
      description: 'Automatic currency rate updates will be available in a future update',
    });
  };

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="general" className="max-w-4xl mx-auto">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="currencies">Currencies</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
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
        </TabsContent>
        
        <TabsContent value="currencies">
          <Card>
            <CardHeader>
              <CardTitle>Currency Management</CardTitle>
              <CardDescription>
                Manage currencies and exchange rates for your transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Exchange Rates</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleAddPKR}
                    disabled={isPKRAdded || isAddingCurrency}
                  >
                    <BadgeIndianRupee className="mr-2 h-4 w-4" /> Add PKR
                  </Button>
                  <Button variant="outline" onClick={handleUpdateRates}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Update Rates
                  </Button>
                </div>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Exchange rates are updated manually. Base currency is USD.
                </AlertDescription>
              </Alert>
              
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Exchange Rate (to USD)</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((currency) => (
                      <TableRow key={currency.code}>
                        <TableCell className="font-medium">
                          <Badge variant="currency">{currency.code}</Badge>
                        </TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell>{currency.symbol}</TableCell>
                        <TableCell>{currency.exchangeRate.toFixed(4)}</TableCell>
                        <TableCell>
                          {format(new Date(currency.lastUpdated), 'MMM dd, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium mb-4">Add New Currency</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currencyCode">Currency Code <span className="text-destructive">*</span></Label>
                    <Input
                      id="currencyCode"
                      placeholder="e.g., EUR"
                      maxLength={3}
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currencyName">Currency Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="currencyName"
                      placeholder="e.g., Euro"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="currencySymbol">Symbol <span className="text-destructive">*</span></Label>
                    <Input
                      id="currencySymbol"
                      placeholder="e.g., €"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="exchangeRate">Exchange Rate (to USD) <span className="text-destructive">*</span></Label>
                    <Input
                      id="exchangeRate"
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      placeholder="e.g., 0.91"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                    />
                  </div>
                </div>
                
                <Button
                  className="mt-4"
                  onClick={handleAddCurrency}
                  disabled={isAddingCurrency}
                >
                  {isAddingCurrency ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" /> Add Currency
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="username"
                    value={currentUser?.username || ''}
                    disabled
                  />
                  <Button variant="outline" disabled>Change</Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="password"
                    value="********"
                    disabled
                  />
                  <Button variant="outline" disabled>Change</Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Password changing will be available in a future update.
                </p>
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="text-lg font-medium text-destructive mb-4">Danger Zone</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  These actions cannot be undone.
                </p>
                
                <div className="flex flex-col gap-4">
                  <Button variant="outline" disabled>Clear All Transactions</Button>
                  <Button variant="destructive" disabled>Delete Account</Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  These features will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default Settings;
