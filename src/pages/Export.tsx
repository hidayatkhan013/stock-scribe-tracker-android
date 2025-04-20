
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { format, subMonths } from 'date-fns';
import { CalendarIcon, FileText, FileDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { db, getTransactionsForUser, getPortfolioSummary, getProfitLossReport } from '@/lib/db';

const Export = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf'>('csv');
  const [dataType, setDataType] = useState<'all' | 'transactions' | 'portfolio' | 'summaries'>('all');
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [exportHistory, setExportHistory] = useState<{
    type: string;
    dataType: string;
    date: Date;
    fileName: string;
    data: any[];
  }[]>([]);

  const handleHistoryClick = (fileName: string, type: string, data: any[]) => {
    if (type === 'PDF') {
      downloadPDF(data, fileName.replace('.pdf', ''));
    } else {
      downloadCSV(data, fileName.replace('.csv', ''));
    }
  };

  const handleExport = async () => {
    if (!currentUser?.id) {
      toast({
        title: 'Authentication Required',
        description: 'Please log in to export data',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      let data: any = [];
      let fileName = `stockscribe-${dataType}-${format(new Date(), 'yyyy-MM-dd')}`;
      
      if (dataType === 'all' || dataType === 'transactions') {
        const transactions = await getTransactionsForUser(currentUser.id);
        const filteredTransactions = transactions.filter(tx => {
          const txDate = new Date(tx.date);
          return txDate >= startDate && txDate <= endDate;
        });
        
        if (dataType === 'all' || dataType === 'transactions') {
          data.push(...filteredTransactions.map(tx => ({
            ...tx,
            date: format(new Date(tx.date), 'yyyy-MM-dd'),
          })));
        }
      }
      
      if (dataType === 'all' || dataType === 'portfolio') {
        const portfolio = await getPortfolioSummary(currentUser.id);
        if (dataType === 'all' || dataType === 'portfolio') {
          data.push(...portfolio);
        }
      }
      
      if (dataType === 'all' || dataType === 'summaries') {
        const reports = await getProfitLossReport(currentUser.id, startDate, endDate);
        if (dataType === 'all' || dataType === 'summaries') {
          if (reports.daily.length) {
            data.push(...reports.daily.map(day => ({
              ...day,
              date: format(new Date(day.date), 'yyyy-MM-dd')
            })));
          }
          if (reports.stocks.length) {
            data.push(...reports.stocks.map(stock => ({
              ticker: stock.stock.ticker,
              name: stock.stock.name,
              profit: stock.profit,
              loss: stock.loss,
              netProfit: stock.net,
              currency: stock.stock.currency
            })));
          }
        }
      }
      
      if (exportType === 'csv') {
        downloadCSV(data, fileName);
      } else {
        downloadPDF(data, fileName);
      }
      
      const newExportHistory = [
        ...exportHistory,
        {
          type: exportType.toUpperCase(),
          dataType: dataType,
          date: new Date(),
          fileName: `${fileName}.${exportType}`,
          data: data
        }
      ];
      setExportHistory(newExportHistory);
      
      toast({
        title: 'Export Successful',
        description: `Your data has been exported as ${fileName}.${exportType}`,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'There was a problem exporting your data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadCSV = (data: any[], fileName: string) => {
    if (!data.length) {
      toast({
        title: 'No Data',
        description: 'There is no data to export for the selected period and type.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const headers = Object.keys(data[0]);
      
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(item => {
        const row = headers.map(header => {
          const cellValue = item[header];
          if (typeof cellValue === 'object' && cellValue !== null) {
            return `"${JSON.stringify(cellValue).replace(/"/g, '""')}"`;
          }
          if (typeof cellValue === 'string' && cellValue.includes(',')) {
            return `"${cellValue}"`;
          }
          return cellValue;
        }).join(',');
        csvContent += row + '\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('CSV generation error:', error);
      toast({
        title: 'Export Error',
        description: 'Could not generate CSV file. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const downloadPDF = (data: any[], fileName: string) => {
    if (!data.length) {
      toast({
        title: 'No Data',
        description: 'There is no data to export for the selected period and type.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const headers = Object.keys(data[0]);
      
      const cleanedData = data.map(item => {
        const cleanedItem: any = {};
        headers.forEach(header => {
          if (item[header] === undefined || item[header] === null) {
            cleanedItem[header] = '';
          } else if (typeof item[header] === 'object') {
            cleanedItem[header] = JSON.stringify(item[header]);
          } else {
            cleanedItem[header] = item[header];
          }
        });
        return cleanedItem;
      });
      
      const htmlContent = `
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              body { font-family: Arial, sans-serif; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { text-align: center; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <h1>StockScribe - ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Export</h1>
            <p>Date Range: ${format(startDate, 'MMM dd, yyyy')} to ${format(endDate, 'MMM dd, yyyy')}</p>
            <table>
              <thead>
                <tr>
                  ${headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${cleanedData.map(row => `
                  <tr>
                    ${headers.map(header => `<td>${row[header]}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="footer">
              Generated by StockScribe on ${format(new Date(), 'MMM dd, yyyy, HH:mm')}
            </div>
          </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], { type: 'text/html' });
      
      // Create a download link instead of opening in browser
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Export Error',
        description: 'Could not generate PDF file. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout title="Export Data">
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Export Your Data</CardTitle>
            <CardDescription>
              Export your stock trading data in different formats
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="exportType">Export Format</Label>
              <Select
                value={exportType}
                onValueChange={(value: 'csv' | 'pdf') => setExportType(value)}
              >
                <SelectTrigger id="exportType" className="border border-input rounded-md">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center">
                      <FileText className="mr-2 h-4 w-4" />
                      CSV (Spreadsheet)
                    </div>
                  </SelectItem>
                  <SelectItem value="pdf">
                    <div className="flex items-center">
                      <FileDown className="mr-2 h-4 w-4" />
                      PDF Document
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {exportType === 'csv' 
                  ? 'CSV files can be opened in Excel, Google Sheets, or other spreadsheet software.' 
                  : 'PDF documents are easy to view and print.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataType">Data to Export</Label>
              <Select 
                value={dataType}
                onValueChange={(value: 'all' | 'transactions' | 'portfolio' | 'summaries') => setDataType(value)}
              >
                <SelectTrigger id="dataType" className="border border-input rounded-md">
                  <SelectValue placeholder="Select data" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Data</SelectItem>
                  <SelectItem value="transactions">Transactions Only</SelectItem>
                  <SelectItem value="portfolio">Portfolio Only</SelectItem>
                  <SelectItem value="summaries">Summary Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[180px] justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "MMM dd, yyyy") : "Start date"}
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
                <span className="self-center text-center">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[180px] justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "MMM dd, yyyy") : "End date"}
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
            </div>

            <div className="pt-4">
              <Button
                className="w-full sm:w-auto"
                onClick={handleExport}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export {exportType.toUpperCase()}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>
              Your recent data exports
            </CardDescription>
          </CardHeader>
          <CardContent>
            {exportHistory.length > 0 ? (
              <div className="space-y-4">
                {exportHistory.map((export_, index) => (
                  <div 
                    key={index} 
                    className="flex justify-between items-center border-b pb-2 hover:bg-accent/5 cursor-pointer p-2 rounded-md transition-colors"
                    onClick={() => handleHistoryClick(export_.fileName, export_.type, export_.data)}
                  >
                    <div>
                      <p className="font-medium">{export_.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(export_.date, "MMM dd, yyyy HH:mm")} - {export_.dataType}
                      </p>
                    </div>
                    <Badge variant="outline" className="hover:bg-primary/10">{export_.type}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No previous exports found
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Export;
