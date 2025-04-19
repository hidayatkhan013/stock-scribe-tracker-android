
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db, Stock, Transaction, addStock, addTransaction } from '@/lib/db';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Form schema
const transactionSchema = z.object({
  ticker: z.string().min(1, "Ticker is required").max(10),
  stockName: z.string().min(1, "Stock name is required"),
  transactionType: z.enum(["buy", "sell"]),
  shares: z.string().refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0, 
    { message: "Must be a positive number" }
  ),
  price: z.string().refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0, 
    { message: "Must be a positive number" }
  ),
  currency: z.string().min(1, "Currency is required"),
  date: z.date(),
  notes: z.string().optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

const NewTransaction = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string; symbol: string }[]>([]);
  
  // Get transaction type from location state if available
  const initialTransactionType = location.state?.transactionType || "buy";
  
  // Initialize the form
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      ticker: "",
      stockName: "",
      transactionType: initialTransactionType,
      shares: "",
      price: "",
      currency: "USD",
      date: new Date(),
      notes: "",
    },
  });
  
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Get user's stocks
        const userStocks = await db.stocks
          .where('userId')
          .equals(currentUser.id)
          .toArray();
        setStocks(userStocks);
        
        // Get currencies
        const allCurrencies = await db.currencies.toArray();
        setCurrencies(allCurrencies);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load data',
          variant: 'destructive',
        });
      }
    };
    
    fetchData();
  }, [currentUser, toast]);
  
  const handleTickerChange = (ticker: string) => {
    // Auto-fill stock name if we have it in our system
    const upperTicker = ticker.toUpperCase();
    form.setValue("ticker", upperTicker);
    
    const existingStock = stocks.find(s => s.ticker === upperTicker);
    if (existingStock) {
      form.setValue("stockName", existingStock.name);
      form.setValue("currency", existingStock.currency);
    }
  };
  
  const onSubmit = async (data: TransactionFormValues) => {
    if (!currentUser?.id) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // First, make sure the stock exists or create it
      const stockId = await addStock({
        ticker: data.ticker,
        name: data.stockName,
        currency: data.currency,
        userId: currentUser.id,
      });
      
      // Create the transaction
      await addTransaction({
        stockId,
        userId: currentUser.id,
        type: data.transactionType,
        shares: Number(data.shares),
        price: Number(data.price),
        currency: data.currency,
        date: data.date,
        notes: data.notes,
      });
      
      toast({
        title: 'Success',
        description: 'Transaction added successfully',
      });
      
      navigate('/transactions');
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to add transaction',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransactionTypeIcon = () => {
    return form.watch("transactionType") === "buy" ? (
      <TrendingUp className="h-5 w-5 mr-2 text-primary" />
    ) : (
      <TrendingDown className="h-5 w-5 mr-2 text-secondary-foreground" />
    );
  };

  return (
    <AppLayout title="New Transaction">
      <Card className="max-w-2xl mx-auto shadow-sm hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-center">
            {getTransactionTypeIcon()}
            <div>
              <CardTitle>{form.watch("transactionType") === "buy" ? "Buy" : "Sell"} Stock</CardTitle>
              <CardDescription>Record a new stock transaction</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ticker Symbol <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., AAPL"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            handleTickerChange(e.target.value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="stockName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Apple Inc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="transactionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transaction Type <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="buy" className="flex items-center">
                            <TrendingUp className="mr-2 h-4 w-4 inline" /> Buy
                          </SelectItem>
                          <SelectItem value="sell" className="flex items-center">
                            <TrendingDown className="mr-2 h-4 w-4 inline" /> Sell
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date <span className="text-destructive">*</span></FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMM dd, yyyy")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="shares"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shares <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Number of shares"
                          type="number"
                          step="any"
                          min="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Share <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Price"
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select currency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.code} ({currency.symbol})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes about this transaction (optional)"
                        className="resize-none h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex gap-4 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/transactions')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                      Saving...
                    </>
                  ) : (
                    `${form.watch("transactionType") === "buy" ? "Buy" : "Sell"} Stock`
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default NewTransaction;
