
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { db, addTransaction, getStock, addStock, getUserSettings } from '@/lib/db';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const formSchema = z.object({
  type: z.enum(["Buy", "Sell"]),
  ticker: z.string().min(1, { message: "Ticker symbol is required" }),
  stockName: z.string().min(1, { message: "Stock name is required" }),
  shares: z.coerce.number().positive({ message: "Must be a positive number" }),
  price: z.coerce.number().positive({ message: "Must be a positive number" }),
  amount: z.coerce.number().optional(),
  date: z.date(),
  currency: z.string().min(1, { message: "Currency is required" }),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const NewTransaction = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currencies, setCurrencies] = useState<{ id: number; code: string; name: string }[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "Buy",
      ticker: "",
      stockName: "",
      shares: undefined,
      price: undefined,
      amount: undefined,
      date: new Date(),
      currency: defaultCurrency,
      note: "",
    },
  });

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const allCurrencies = await db.currencies.toArray();
        setCurrencies(allCurrencies);

        if (currentUser?.id) {
          const settings = await getUserSettings(currentUser.id);
          if (settings?.defaultCurrency) {
            setDefaultCurrency(settings.defaultCurrency);
            form.setValue('currency', settings.defaultCurrency);
          }
        }
      } catch (error) {
        console.error('Error loading currencies:', error);
      }
    };

    loadCurrencies();
  }, [currentUser, form]);

  const watchShares = form.watch('shares');
  const watchPrice = form.watch('price');
  const watchType = form.watch('type');
  const watchTicker = form.watch('ticker');

  useEffect(() => {
    const calculateAmount = () => {
      const shares = form.getValues('shares');
      const price = form.getValues('price');
      
      if (shares && price) {
        form.setValue('amount', parseFloat((shares * price).toFixed(2)));
      }
    };
    
    calculateAmount();
  }, [watchShares, watchPrice, form]);

  useEffect(() => {
    const loadStockDetails = async () => {
      const ticker = form.getValues('ticker');
      if (!ticker || ticker.length < 1) return;
      
      try {
        const stockInfo = await getStock(ticker);
        if (stockInfo) {
          form.setValue('stockName', stockInfo.name);
          if (stockInfo.currency) {
            form.setValue('currency', stockInfo.currency);
          }
        }
      } catch (error) {
        console.error('Error loading stock details:', error);
      }
    };
    
    loadStockDetails();
  }, [watchTicker, form]);

  const onSubmit = async (data: FormValues) => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add transactions",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if stock exists, if not create it
      let stockId: number | undefined;
      const existingStock = await getStock(data.ticker);
      
      if (existingStock) {
        stockId = existingStock.id;
      } else {
        stockId = await addStock({
          ticker: data.ticker,
          name: data.stockName,
          currency: data.currency,
        });
      }

      if (!stockId) {
        throw new Error("Failed to get or create stock");
      }

      // Add the transaction
      await addTransaction({
        userId: currentUser.id,
        stockId,
        type: data.type,
        shares: data.shares,
        price: data.price,
        amount: data.amount || data.shares * data.price,
        date: data.date,
        note: data.note || '',
      });

      toast({
        title: "Transaction Added",
        description: `Successfully added ${data.type} transaction for ${data.ticker}`,
      });

      navigate("/transactions");
    } catch (error) {
      console.error('Error adding transaction:', error);
      toast({
        title: "Transaction Failed",
        description: "There was an error adding your transaction. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="New Transaction">
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Add New Transaction</CardTitle>
            <CardDescription>Record a new stock purchase or sale</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Transaction Type</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-1"
                        >
                          <div className="flex items-center space-x-2 flex-1">
                            <RadioGroupItem value="Buy" id="buy" />
                            <Label
                              htmlFor="buy"
                              className="flex-1 py-2 rounded-md text-center cursor-pointer bg-green-50 hover:bg-green-100 border border-green-200"
                            >
                              BUY
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2 flex-1">
                            <RadioGroupItem value="Sell" id="sell" />
                            <Label
                              htmlFor="sell"
                              className="flex-1 py-2 rounded-md text-center cursor-pointer bg-red-50 hover:bg-red-100 border border-red-200"
                            >
                              SELL
                            </Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ticker"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ticker Symbol</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. AAPL" {...field} />
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
                        <FormLabel>Stock Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Apple Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="shares"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Shares</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter number of shares" 
                            step="any"
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value));
                            }}
                            value={field.value === undefined ? '' : field.value}
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
                        <FormLabel>Price per Share</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter price per share"
                            step="any"
                            {...field} 
                            onChange={(e) => {
                              field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value));
                            }}
                            value={field.value === undefined ? '' : field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          readOnly 
                          value={field.value === undefined ? '' : field.value}
                          className="bg-muted cursor-not-allowed"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Transaction Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="center">
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

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((currency) => (
                              <SelectItem key={currency.id} value={currency.code}>
                                {currency.code} - {currency.name}
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
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Any additional information..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/transactions")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Transaction"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default NewTransaction;
