
import { useState } from 'react';
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
  const [isPKRAdded, setIsPKRAdded] = useState(
    currencies.some(c => c.code === 'PKR')
  );

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
        exchangeRate: 278.5,
        lastUpdated: new Date(),
      };

      await db.currencies.add(pkrCurrency);
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
      const newCurrency: Currency = {
        code: newCode.toUpperCase(),
        name: newName,
        symbol: newSymbol,
        exchangeRate: rateValue,
        lastUpdated: new Date(),
      };

      await db.currencies.add(newCurrency);
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

  const handleUpdateRates = () => {
    toast({
      title: 'Coming Soon',
      description: 'Automatic currency rate updates will be available in a future update',
    });
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
  );
}
