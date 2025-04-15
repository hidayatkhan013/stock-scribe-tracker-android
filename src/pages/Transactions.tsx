
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Search, ArrowUpDown, ArrowDown, ArrowUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { db, Transaction, Stock } from '@/lib/db';
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

  useEffect(() => {
    const loadTransactions = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Get all transactions for the current user
        const txs = await db.transactions
          .where('userId')
          .equals(currentUser.id)
          .toArray();
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
          transaction.currency.toLowerCase().includes(term) ||
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
        <Button onClick={() => navigate('/transactions/new')}>
          <Plus className="mr-2 h-4 w-4" /> Add Transaction
        </Button>
      </div>

      <Card>
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
                    const totalValue = transaction.shares * transaction.price;
                    
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
                          <Badge variant={transaction.type === 'buy' ? 'outline' : 'secondary'}>
                            {transaction.type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.shares}</TableCell>
                        <TableCell>{transaction.price.toFixed(2)} {transaction.currency}</TableCell>
                        <TableCell className="text-right">
                          {totalValue.toFixed(2)} {transaction.currency}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p className="mb-2">No transactions found</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => navigate('/transactions/new')}
                        >
                          <Plus className="mr-2 h-4 w-4" /> Add your first transaction
                        </Button>
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
