import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, getProfitLossReport, getUserSettings } from '@/lib/db';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { format, subDays, subMonths, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { CalendarIcon, Download, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const Reports = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 1));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [profitLossData, setProfitLossData] = useState<any>({ daily: [], stocks: [] });
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalLoss, setTotalLoss] = useState(0);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState<{[key: string]: number}>({});

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUser?.id) return;
      
      try {
        // Load currencies
        const allCurrencies = await db.currencies.toArray();
        const rates: {[key: string]: number} = {};
        allCurrencies.forEach(curr => {
          rates[curr.code] = curr.exchangeRate;
        });
        setExchangeRates(rates);
        
        // Get user's default currency
        const settings = await getUserSettings(currentUser.id);
        if (settings?.defaultCurrency) {
          setDefaultCurrency(settings.defaultCurrency);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    
    loadSettings();
  }, [currentUser]);

  useEffect(() => {
    loadReportData();
  }, [currentUser, reportType, startDate, endDate, defaultCurrency, exchangeRates]);

  const loadReportData = async () => {
    if (!currentUser?.id || Object.keys(exchangeRates).length === 0) return;

    setIsLoading(true);
    try {
      let start = startDate;
      let end = endDate;

      // Adjust date range based on report type
      if (reportType === 'daily') {
        start = subDays(new Date(), 30);
        end = new Date();
      } else if (reportType === 'monthly') {
        start = startOfMonth(subMonths(new Date(), 1));
        end = endOfMonth(new Date());
      }

      // Get profit/loss data
      const plReport = await getProfitLossReport(currentUser.id, start, end);
      
      // Convert values to default currency
      const convertedStocks = plReport.stocks.map((item: any) => {
        const fromRate = exchangeRates[item.stock.currency] || 1;
        const toRate = exchangeRates[defaultCurrency] || 1;
        const conversionRate = toRate / fromRate;
        
        return {
          ...item,
          profit: item.profit * conversionRate,
          loss: item.loss * conversionRate,
          net: item.net * conversionRate,
          originalCurrency: item.stock.currency
        };
      });

      const convertedDaily = plReport.daily.map((day: any) => {
        const convertedEntries = Object.entries(day.currencies || {}).reduce((acc: any, [currency, value]: [string, any]) => {
          const fromRate = exchangeRates[currency] || 1;
          const toRate = exchangeRates[defaultCurrency] || 1;
          const conversionRate = toRate / fromRate;
          acc[currency] = {
            profit: value.profit * conversionRate,
            loss: value.loss * conversionRate,
          };
          return acc;
        }, {});

        return {
          ...day,
          currencies: convertedEntries,
          profit: Object.values(convertedEntries).reduce((sum: number, curr: any) => sum + curr.profit, 0),
          loss: Object.values(convertedEntries).reduce((sum: number, curr: any) => sum + curr.loss, 0),
          net: Object.values(convertedEntries).reduce((sum: number, curr: any) => sum + (curr.profit - curr.loss), 0)
        };
      });

      setProfitLossData({
        stocks: convertedStocks,
        daily: convertedDaily
      });

      // Calculate totals in default currency
      const profit = convertedStocks.reduce((sum: number, item: any) => sum + item.profit, 0);
      const loss = convertedStocks.reduce((sum: number, item: any) => sum + item.loss, 0);
      setTotalProfit(profit);
      setTotalLoss(loss);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    toast({
      title: 'Coming Soon',
      description: 'The export feature will be available in a future update',
    });
  };

  return (
    <AppLayout title="Reports">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-40">
            <Select 
              value={reportType} 
              onValueChange={(value: 'daily' | 'monthly' | 'custom') => setReportType(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {reportType === 'custom' && (
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    disabled={(date) => date > endDate || date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, "MMM dd, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={(date) => date < startDate || date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
        
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" /> Export Report
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="h-4 w-4 mr-1 text-green-500" />
              Total Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-profit">{defaultCurrency} {totalProfit.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="h-4 w-4 mr-1 text-red-500" />
              Total Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-loss">{defaultCurrency} {totalLoss.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Net Profit/Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit - totalLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
              {defaultCurrency} {(totalProfit - totalLoss).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Performance by Stock</CardTitle>
            <CardDescription>Profit and loss breakdown by stock</CardDescription>
          </CardHeader>
          <CardContent>
            {profitLossData.stocks.length > 0 ? (
              <div className="space-y-4">
                {profitLossData.stocks.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between pb-2 border-b">
                    <div className="flex flex-col">
                      <span className="font-medium">{item.stock.ticker}</span>
                      <span className="text-sm text-muted-foreground">{item.stock.name}</span>
                    </div>
                    <div className={`font-medium ${item.net >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {item.net >= 0 ? '+' : ''}{item.net.toFixed(2)} {defaultCurrency}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No data available for the selected period
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Daily Performance</CardTitle>
            <CardDescription>Profit and loss by day</CardDescription>
          </CardHeader>
          <CardContent>
            {profitLossData.daily.length > 0 ? (
              <div className="space-y-4">
                {profitLossData.daily.map((day: any, index: number) => (
                  <div key={index} className="flex items-center justify-between pb-2 border-b">
                    <div className="font-medium">
                      {format(new Date(day.date), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-xs text-muted-foreground">Profit</span>
                        <div className="text-sm text-profit">{defaultCurrency} {day.profit.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Loss</span>
                        <div className="text-sm text-loss">{defaultCurrency} {day.loss.toFixed(2)}</div>
                      </div>
                      <div className={`font-medium ${day.net >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {day.net >= 0 ? '+' : ''}{day.net.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                No data available for the selected period
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Reports;
