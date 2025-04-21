
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, RefreshCw, Plus, BadgeIndianRupee } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { Currency, db } from '@/lib/db';

interface CurrencySettingsProps {
  currencies: Currency[];
  setCurrencies: (currencies: Currency[]) => void;
}

export function CurrencySettings({ currencies, setCurrencies }: CurrencySettingsProps) {
  const { toast } = useToast();
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newSymbol, setNewSymbol] = useState('');
  const [newRate, setNewRate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPKRAdded, setIsPKRAdded] = useState(
    currencies.some(c => c.code === 'PKR')
  );

  // Add functionality to fetch exchange rates from an internet source
  const fetchExchangeRates = async () => {
    setIsLoading(true);
    try {
      // Fetch latest exchange rates from an API
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) {
        throw new Error('Failed to fetch currency rates');
      }
      
      const data = await response.json();
      
      if (data.rates) {
        // Update existing currencies with the latest rates
        const updatedCurrencies: Currency[] = [];
        
        for (const currency of currencies) {
          if (data.rates[currency.code]) {
            // Update rate
            await db.currencies.update(currency.id as number, {
              exchangeRate: data.rates[currency.code],
              lastUpdated: new Date()
            });
            
            updatedCurrencies.push({
              ...currency,
              exchangeRate: data.rates[currency.code],
              lastUpdated: new Date()
            });
          } else {
            updatedCurrencies.push(currency);
          }
        }
        
        setCurrencies(updatedCurrencies);
        
        toast({
          title: 'Exchange Rates Updated',
          description: 'Currency rates have been updated with the latest values',
        });
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      toast({
        title: 'Error',
        description: 'Failed to update exchange rates. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      // Try to get real-time exchange rate for PKR
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (response.ok) {
          const data = await response.json();
          if (data.rates && data.rates.PKR) {
            // Generate a new ID (using a timestamp is simple but may collide - better to use the DB's auto-increment)
            const newId = await db.currencies.add({
              code: 'PKR',
              name: 'Pakistani Rupee',
              symbol: '₨',
              exchangeRate: data.rates.PKR,
              lastUpdated: new Date()
            });
            
            const pkrCurrency: Currency = {
              id: newId,
              code: 'PKR',
              name: 'Pakistani Rupee',
              symbol: '₨',
              exchangeRate: data.rates.PKR,
              lastUpdated: new Date(),
            };
            
            setCurrencies([...currencies, pkrCurrency]);
            setIsPKRAdded(true);
            
            toast({
              title: 'Currency Added',
              description: 'Pakistani Rupee (PKR) has been added successfully with current exchange rate',
            });
            return;
          }
        }
      } catch (error) {
        console.error('Error fetching PKR rate:', error);
      }
      
      // Fallback to default rate if API call fails
      const newId = await db.currencies.add({
        code: 'PKR',
        name: 'Pakistani Rupee',
        symbol: '₨',
        exchangeRate: 278.5,
        lastUpdated: new Date()
      });
      
      const pkrCurrency: Currency = {
        id: newId,
        code: 'PKR',
        name: 'Pakistani Rupee',
        symbol: '₨',
        exchangeRate: 278.5,
        lastUpdated: new Date(),
      };

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

  const handleAddCurrency = async () => {
    if (!newCode || !newName || !newSymbol || !newRate) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

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
      // Try to get real-time exchange rate for the currency
      let finalRate = rateValue;
      try {
        const response = await fetch(`https://open.er-api.com/v6/latest/USD`);
        if (response.ok) {
          const data = await response.json();
          if (data.rates && data.rates[newCode.toUpperCase()]) {
            finalRate = data.rates[newCode.toUpperCase()];
          }
        }
      } catch (error) {
        console.error('Error fetching rate:', error);
        // Use the manually entered rate as fallback
      }
      
      // Add the currency to the database and get the auto-generated ID
      const newId = await db.currencies.add({
        code: newCode.toUpperCase(),
        name: newName,
        symbol: newSymbol,
        exchangeRate: finalRate,
        lastUpdated: new Date(),
      });
      
      const newCurrency: Currency = {
        id: newId,
        code: newCode.toUpperCase(),
        name: newName,
        symbol: newSymbol,
        exchangeRate: finalRate,
        lastUpdated: new Date(),
      };

      setCurrencies([...currencies, newCurrency]);

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

  return (
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
            <Button 
              variant="outline" 
              onClick={fetchExchangeRates}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> 
              {isLoading ? 'Updating...' : 'Update Rates'}
            </Button>
          </div>
        </div>
        
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Exchange rates are updated from open.er-api.com. Base currency is USD.
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
                    {format(new Date(currency.lastUpdated), 'MMM dd, yyyy HH:mm')}
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
  );
}
