
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, PlusCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Stock, db } from '@/lib/db';

const NewTransaction = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [stock, setStock] = useState<Stock | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [date, setDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: any) => {
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
        quantity,
        price,
        date, // Using Date object directly
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

  return (
    <AppLayout title="New Transaction">
      <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Transaction</CardTitle>
            <CardDescription>Record your stock trade details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="stock">Stock Ticker</Label>
              <Input
                id="stock"
                type="text"
                placeholder="Enter stock ticker"
                value={stock ? stock.ticker : ''}
                onChange={async (e) => {
                  const ticker = e.target.value.toUpperCase();
                  if (ticker) {
                    const foundStock = await db.stocks.where('ticker').equals(ticker).first();
                    if (foundStock) {
                      setStock(foundStock);
                    } else {
                      // If stock doesn't exist, create a new one with userId
                      const newStock = {
                        ticker: ticker,
                        name: ticker, // You might want to fetch the actual name from an API
                        currency: 'USD', // You might want to fetch the actual currency from an API
                        userId: currentUser?.id || 0, // Add the required userId property
                      };
                      const id = await db.stocks.add(newStock);
                      const createdStock = await db.stocks.get(id);
                      setStock(createdStock);
                    }
                  } else {
                    setStock(null);
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
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
            <Button disabled={isLoading}>
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Transaction
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
