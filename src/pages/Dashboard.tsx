import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, getPortfolioSummary, getProfitLossReport, Currency, getUserSettings } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { subDays } from 'date-fns';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [portfolioSummary, setPortfolioSummary] = useState<any[]>([]);
  const [profitLossData, setProfitLossData] = useState<any>({ daily: [] });
  const [totalInvested, setTotalInvested] = useState<number>(0);
  const [totalProfit, setTotalProfit] = useState<number>(0);
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
      
      // Check for default currency in settings using getUserSettings helper
      const settings = await getUserSettings(currentUser.id);
      if (settings?.defaultCurrency) {
        setDefaultCurrency(settings.defaultCurrency);
      }
    };
    
    loadCurrencies();
  }, [currentUser]);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!currentUser?.id) return;

      try {
        // Get portfolio summary
        const summary = await getPortfolioSummary(currentUser.id);
        
        // Convert all values to the selected currency
        const convertedSummary = summary.map(item => {
          if (!item.stock) {
            return {
              ...item,
              originalCurrency: defaultCurrency,
              totalCost: 0,
              profitLoss: 0,
              averageCost: 0
            };
          }
          
          const stockCurrency = item.stock.currency || defaultCurrency;
          const fromRate = exchangeRates[stockCurrency] || 1;
          const toRate = exchangeRates[defaultCurrency] || 1;
          const conversionRate = toRate / fromRate;
          
          return {
            ...item,
            originalCurrency: stockCurrency,
            totalCost: item.totalCost * conversionRate,
            profitLoss: item.profitLoss * conversionRate,
            averageCost: item.averageCost * conversionRate
          };
        });
        
        setPortfolioSummary(convertedSummary);

        // Calculate totals in the selected currency
        const totalInv = convertedSummary.reduce((acc, item) => acc + item.totalCost, 0);
        const totalPL = convertedSummary.reduce((acc, item) => acc + item.profitLoss, 0);
        setTotalInvested(totalInv);
        setTotalProfit(totalPL);

        // Get profit/loss data for the chart (last 30 days)
        const endDate = new Date();
        const startDate = subDays(endDate, 30);
        const plReport = await getProfitLossReport(currentUser.id, startDate, endDate);
        setProfitLossData(plReport);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (Object.keys(exchangeRates).length > 0) {
      loadDashboardData();
    }
  }, [currentUser, exchangeRates, defaultCurrency]);

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Dashboard Overview</h1>
        <Badge variant="currency" className="text-sm">
          Showing in {defaultCurrency}
        </Badge>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-medium">Total Invested</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvested.toFixed(2)} {defaultCurrency}</div>
            <p className="text-xs text-muted-foreground">Across {portfolioSummary.length} stocks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-medium">Total Profit/Loss</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)} {defaultCurrency}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalProfit >= 0 ? 'Profit' : 'Loss'} from all transactions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-medium">Return</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalInvested > 0 
                ? `${((totalProfit / totalInvested) * 100).toFixed(2)}%` 
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">Return on investment</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Performance</h2>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={() => navigate('/transactions/new', { state: { transactionType: 'buy' } })}
              variant="default"
            >
              <TrendingUp className="mr-1 h-4 w-4" /> Buy Stock
            </Button>
            <Button 
              size="sm" 
              onClick={() => navigate('/transactions/new', { state: { transactionType: 'sell' } })}
              variant="destructive"
            >
              <TrendingDown className="mr-1 h-4 w-4" /> Sell Stock
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>30-Day Profit/Loss</CardTitle>
            <CardDescription>Your trading performance over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 h-80">
            {profitLossData.daily.length > 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Performance chart will appear here</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p>No transaction data available</p>
                <div className="flex gap-2 mt-2">
                  <Button 
                    variant="default" 
                    onClick={() => navigate('/transactions/new', { state: { transactionType: 'buy' } })}
                  >
                    <TrendingUp className="mr-2 h-4 w-4" /> Buy Stock
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => navigate('/transactions/new', { state: { transactionType: 'sell' } })}
                  >
                    <TrendingDown className="mr-2 h-4 w-4" /> Sell Stock
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Your Portfolio</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolioSummary.length > 0 ? (
            portfolioSummary.map((item) => (
              <Card key={`portfolio-${item.stock?.id || 'unknown'}`}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{item.stock?.ticker || 'Unknown'}</CardTitle>
                    <span className={`text-sm font-medium ${item.profitLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {item.profitLoss >= 0 ? '+' : ''}{item.profitLoss.toFixed(2)} {defaultCurrency}
                    </span>
                  </div>
                  <CardDescription className="flex items-center justify-between">
                    <span>{item.stock?.name || 'Unknown Stock'}</span>
                    {item.originalCurrency !== defaultCurrency && (
                      <Badge variant="outline" className="text-xs">
                        Originally in {item.originalCurrency}
                      </Badge>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
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
              <CardContent className="flex flex-col items-center justify-center py-8">
                <p className="text-muted-foreground mb-4">Your portfolio is empty</p>
                <div className="flex gap-2">
                  <Button 
                    onClick={() => navigate('/transactions/new', { state: { transactionType: 'buy' } })}
                    variant="default"
                  >
                    <TrendingUp className="mr-2 h-4 w-4" /> Buy Stock
                  </Button>
                  <Button 
                    onClick={() => navigate('/transactions/new', { state: { transactionType: 'sell' } })}
                    variant="destructive"
                  >
                    <TrendingDown className="mr-2 h-4 w-4" /> Sell Stock
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
