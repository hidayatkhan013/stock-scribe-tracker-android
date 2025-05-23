import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, ArrowDown, ArrowUp, TrendingUp, TrendingDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { db, Transaction, Stock, Currency, getUserSettings } from '@/lib/db';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const Transactions = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Transaction>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stocks, setStocks] = useState<Map<number | undefined, Stock>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [defaultCurrency, setDefaultCurrency] = useState<string>('USD');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{[key: string]: number}>({});

  useEffect(() => {
    const loadCurrencies = async () => {
      if (!currentUser?.id) return;
      
      const allCurrencies = await db.currencies.toArray();
      setCurrencies(allCurrencies);
      
      // Create exchange rates lookup object
      const rates: {[key: string]: number} = {};
      allCurrencies.forEach(curr => {
        rates[curr.code] = curr.exchangeRate;
      });
      setExchangeRates(rates);
      
      // Check for default currency in settings using getUserSettings helper
      const settings = await getUserSettings(currentUser.id);
      if (settings?.defaultCurrency) {
        setDefaultCurrency(settings.defaultCurrency);
      }
    };
    
    loadCurrencies();
  }, [currentUser]);

  useEffect(() => {
    const loadTransactions = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Get all transactions for the current user
        const txs = await db.transactions
          .where('userId')
          .equals(currentUser.id)
          .toArray();
          
        // If any transactions are missing the currency property, use their stock's currency
        for (let tx of txs) {
          if (!tx.currency) {
            const stock = await db.stocks.get(tx.stockId);
            if (stock) {
              // Update transaction with stock's currency
              tx.currency = stock.currency;
              // Optionally update in DB too
              await db.transactions.update(tx.id as number, { currency: stock.currency });
            } else {
              // Fallback to USD if stock can't be found
              tx.currency = 'USD';
            }
          }
        }
        
        setTransactions(txs);
        
        // Get all stocks for the current user
        const stocksArray = await db.stocks
          .where('userId')
          .equals(currentUser.id)
          .toArray();
        const stocksMap = new Map(stocksArray.map(stock => [stock.id, stock]));
        setStocks(stocksMap);
      } catch (error) {
        console.error('Error loading transactions:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTransactions();
  }, [currentUser]);

  const handleSort = (field: keyof Transaction) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const convertCurrency = (amount: number, fromCurrency: string): number => {
    if (fromCurrency === defaultCurrency) return amount;
    
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[defaultCurrency] || 1;
    return amount * (toRate / fromRate);
  };

  const navigateToNewTransaction = (type: 'buy' | 'sell') => {
    navigate('/transactions/new', { state: { transactionType: type } });
  };

  const sortedAndFilteredTransactions = (() => {
    // Filter transactions
    let filtered = transactions;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = transactions.filter(transaction => {
        const stock = stocks.get(transaction.stockId);
        return (
          stock?.ticker.toLowerCase().includes(term) ||
          stock?.name.toLowerCase().includes(term) ||
          transaction.type.toLowerCase().includes(term) ||
          (transaction.currency && transaction.currency.toLowerCase().includes(term)) ||
          format(new Date(transaction.date), 'MMM dd, yyyy').toLowerCase().includes(term)
        );
      });
    }

    // Sort transactions
    return filtered.sort((a, b) => {
      let compareValue = 0;

      if (sortField === 'date') {
        compareValue = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === 'shares' || sortField === 'price') {
        compareValue = a[sortField] - b[sortField];
      } else if (sortField === 'type') {
        compareValue = a.type.localeCompare(b.type);
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });
  })();

  if (isLoading) {
    return (
      <AppLayout title="Transactions">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Transactions">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold hidden sm:block">Transactions</h1>
        <Badge variant="currency" className="text-sm">
          Showing in {defaultCurrency}
        </Badge>
      </div>
    
      <div className="flex flex-col-reverse sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={() => navigateToNewTransaction('buy')}
            className="flex-1 sm:flex-auto"
            variant="default"
          >
            <TrendingUp className="mr-2 h-4 w-4" /> Buy Stock
          </Button>
          <Button 
            onClick={() => navigateToNewTransaction('sell')}
            className="flex-1 sm:flex-auto"
            variant="destructive"
          >
            <TrendingDown className="mr-2 h-4 w-4" /> Sell Stock
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]" onClick={() => handleSort('date')}>
                    <div className="flex items-center cursor-pointer">
                      Date
                      {sortField === 'date' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead onClick={() => handleSort('type')}>
                    <div className="flex items-center cursor-pointer">
                      Type
                      {sortField === 'type' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('shares')}>
                    <div className="flex items-center cursor-pointer">
                      Shares
                      {sortField === 'shares' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead onClick={() => handleSort('price')}>
                    <div className="flex items-center cursor-pointer">
                      Price
                      {sortField === 'price' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAndFilteredTransactions?.length > 0 ? (
                  sortedAndFilteredTransactions.map((transaction) => {
                    const stock = stocks?.get(transaction.stockId);
                    const originalPrice = transaction.price;
                    const originalTotal = transaction.shares * originalPrice;
                    
                    // Use transaction.currency, defaulting to stock's currency if missing
                    const txCurrency = transaction.currency || stock?.currency || 'USD';
                    
                    // Convert to selected currency if needed
                    const convertedPrice = convertCurrency(originalPrice, txCurrency);
                    const convertedTotal = transaction.shares * convertedPrice;
                    
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-medium">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{stock?.ticker}</span>
                            <span className="text-muted-foreground text-xs">{stock?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.type === 'buy' ? 'default' : 'destructive'}>
                            {transaction.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.shares}</TableCell>
                        <TableCell>
                          {convertedPrice.toFixed(2)} {defaultCurrency}
                          {txCurrency !== defaultCurrency && (
                            <div className="text-xs text-muted-foreground">
                              Originally: {originalPrice.toFixed(2)} {txCurrency}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {convertedTotal.toFixed(2)} {defaultCurrency}
                          {txCurrency !== defaultCurrency && (
                            <div className="text-xs text-muted-foreground text-right">
                              Originally: {originalTotal.toFixed(2)} {txCurrency}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p className="mb-4">No transactions found</p>
                        <div className="flex gap-2">
                          <Button 
                            variant="default" 
                            size="sm" 
                            onClick={() => navigateToNewTransaction('buy')}
                          >
                            <TrendingUp className="mr-2 h-4 w-4" /> Buy Stock
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => navigateToNewTransaction('sell')}
                          >
                            <TrendingDown className="mr-2 h-4 w-4" /> Sell Stock
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default Transactions;
