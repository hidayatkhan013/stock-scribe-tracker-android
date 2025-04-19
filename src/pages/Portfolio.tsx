
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, getPortfolioSummary, Currency, getUserSettings } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, PlusCircle } from 'lucide-react';

const Portfolio = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [portfolioSummary, setPortfolioSummary] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
      
      // Check for default currency in settings
      const settings = await getUserSettings(currentUser.id);
      if (settings?.defaultCurrency) {
        setDefaultCurrency(settings.defaultCurrency);
      }
    };
    
    loadCurrencies();
  }, [currentUser]);

  useEffect(() => {
    const loadPortfolio = async () => {
      if (!currentUser?.id || Object.keys(exchangeRates).length === 0) return;

      try {
        // Get portfolio summary
        const summary = await getPortfolioSummary(currentUser.id);
        
        // Convert all values to the selected currency
        const convertedSummary = summary.map(item => {
          const fromRate = exchangeRates[item.stock.currency] || 1;
          const toRate = exchangeRates[defaultCurrency] || 1;
          const conversionRate = toRate / fromRate;
          
          return {
            ...item,
            originalCurrency: item.stock.currency,
            totalCost: item.totalCost * conversionRate,
            profitLoss: item.profitLoss * conversionRate,
            averageCost: item.averageCost * conversionRate
          };
        });
        
        setPortfolioSummary(convertedSummary);
      } catch (error) {
        console.error('Error loading portfolio data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPortfolio();
  }, [currentUser, exchangeRates, defaultCurrency]);

  const handleAddTransaction = () => {
    navigate('/transactions/new');
  };

  if (isLoading) {
    return (
      <AppLayout title="Portfolio">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Portfolio">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <BookOpen className="mr-2 h-6 w-6" /> Your Investment Portfolio
          </h1>
          <p className="text-muted-foreground">Manage and track your stock investments</p>
        </div>
        <Badge variant="currency" className="text-sm">
          Showing in {defaultCurrency}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {portfolioSummary.length > 0 ? (
          portfolioSummary.map((item) => (
            <Card key={`portfolio-${item.stock.id}`} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{item.stock.ticker}</CardTitle>
                  <span className={`text-sm font-medium ${item.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {item.profitLoss >= 0 ? '+' : ''}{item.profitLoss.toFixed(2)} {defaultCurrency}
                  </span>
                </div>
                <CardDescription className="flex items-center justify-between">
                  <span>{item.stock.name}</span>
                  {item.originalCurrency !== defaultCurrency && (
                    <Badge variant="outline" className="text-xs">
                      Originally in {item.originalCurrency}
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Shares</p>
                    <p className="font-medium">{item.shares}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Cost</p>
                    <p className="font-medium">{item.averageCost.toFixed(2)} {defaultCurrency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Cost</p>
                    <p className="font-medium">{item.totalCost.toFixed(2)} {defaultCurrency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Return</p>
                    <p className={`font-medium ${item.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {item.totalCost > 0 
                        ? `${((item.profitLoss / item.totalCost) * 100).toFixed(2)}%` 
                        : 'N/A'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Your portfolio is empty</h3>
              <p className="text-muted-foreground text-center mb-6">
                Start building your investment portfolio by adding your first stock transaction.
              </p>
              <Button onClick={handleAddTransaction} className="gap-2">
                <PlusCircle className="h-4 w-4" />
                Add Your First Stock
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Portfolio;
