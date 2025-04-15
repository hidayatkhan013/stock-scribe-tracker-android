
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, getProfitLossReport } from '@/lib/db';
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
import { CalendarIcon, Download } from 'lucide-react';
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

  useEffect(() => {
    loadReportData();
  }, [currentUser, reportType, startDate, endDate]);

  const loadReportData = async () => {
    if (!currentUser?.id) return;

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
      setProfitLossData(plReport);

      // Calculate totals
      const profit = plReport.stocks.reduce((sum: number, item: any) => sum + item.profit, 0);
      const loss = plReport.stocks.reduce((sum: number, item: any) => sum + item.loss, 0);
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-profit">${totalProfit.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-loss">${totalLoss.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit - totalLoss >= 0 ? 'text-profit' : 'text-loss'}`}>
              ${(totalProfit - totalLoss).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
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
                      {item.net >= 0 ? '+' : ''}{item.net.toFixed(2)} {item.stock.currency}
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
        
        <Card>
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
                        <div className="text-sm text-profit">${day.profit.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Loss</span>
                        <div className="text-sm text-loss">${day.loss.toFixed(2)}</div>
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
