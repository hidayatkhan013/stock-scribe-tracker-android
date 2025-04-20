
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Stock, db, getUserSettings } from '@/lib/db';

const NewTransaction = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [stock, setStock] = useState<Stock | null>(null);
  const [stockInput, setStockInput] = useState<string>('');
  const [shares, setShares] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [date, setDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const [currency, setCurrency] = useState<string>('USD');
  
  // Get transaction type from location state, if available
  useEffect(() => {
    if (location.state?.transactionType) {
      setTransactionType(location.state.transactionType);
    }
  }, [location.state]);
  
  // Load user's default currency
  useEffect(() => {
    const loadDefaultCurrency = async () => {
      if (currentUser?.id) {
        const settings = await getUserSettings(currentUser.id);
        if (settings?.defaultCurrency) {
          setCurrency(settings.defaultCurrency);
        }
      }
    };
    
    loadDefaultCurrency();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser?.id || !stock) {
      toast({
        title: 'Error',
        description: 'Please select a stock and ensure you are logged in.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Save transaction to database
      await db.transactions.add({
        userId: currentUser.id,
        stockId: stock.id,
        type: transactionType, // Set transaction type (buy/sell)
        shares: shares,
        price: price,
        currency: currency,
        date: date,
        notes: ''
      });

      toast({
        title: 'Success',
        description: 'Transaction added successfully!',
      });

      navigate('/transactions');
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to add transaction. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTickerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setStockInput(input);
    
    if (!input) {
      setStock(null);
      return;
    }
    
    // Convert to uppercase only if input exists
    const ticker = input.toUpperCase();
    
    if (ticker && currentUser?.id) {
      const foundStock = await db.stocks.where('ticker').equals(ticker).first();
      if (foundStock) {
        setStock(foundStock);
      } else {
        // If stock doesn't exist, create a new one with userId
        const newStock: Stock = {
          ticker: ticker,
          name: ticker, // You might want to fetch the actual name from an API
          currency: currency, // Use user's default currency
          userId: currentUser.id
        };
        const id = await db.stocks.add(newStock);
        const createdStock = await db.stocks.get(id);
        if (createdStock) {
          setStock(createdStock);
        }
      }
    }
  };

  return (
    <AppLayout title={`${transactionType === 'buy' ? 'Buy' : 'Sell'} Stock`}>
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{transactionType === 'buy' ? 'Buy' : 'Sell'} Stock</CardTitle>
            <CardDescription>Record your stock trade details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="stock">Stock Ticker</Label>
              <Input
                id="stock"
                type="text"
                placeholder="Enter stock ticker"
                value={stockInput}
                onChange={handleTickerChange}
              />
            </div>
            <div>
              <Label htmlFor="shares">Shares</Label>
              <Input
                id="shares"
                type="number"
                placeholder="Enter number of shares"
                value={shares}
                onChange={(e) => setShares(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                placeholder="Enter price"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Transaction Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={
                      "w-[240px] justify-start text-left font-normal" +
                      (date ? "" : " text-muted-foreground")
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button 
              type="submit" 
              disabled={isLoading}
              variant={transactionType === 'buy' ? 'default' : 'destructive'}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  {transactionType === 'buy' ? (
                    <TrendingUp className="mr-2 h-4 w-4" />
                  ) : (
                    <TrendingDown className="mr-2 h-4 w-4" />
                  )}
                  {transactionType === 'buy' ? 'Buy' : 'Sell'} Stock
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </AppLayout>
  );
};

export default NewTransaction;
