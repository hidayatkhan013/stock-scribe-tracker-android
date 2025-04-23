
import { useState, useEffect } from 'react';
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
import { CalendarIcon, FileText, FileDown, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { db, getTransactionsForUser, getPortfolioSummary, getProfitLossReport } from '@/lib/db';
import { downloadCSV, downloadPDF, isAndroid, isCapacitorNative } from '@/utils/fileUtils';

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
    fullPath?: string;
    data: any[];
  }[]>([]);
  const [isAndroidDevice, setIsAndroidDevice] = useState(false);
  const [androidPermissionAttempted, setAndroidPermissionAttempted] = useState(false);

  // Check if running on Android device
  useEffect(() => {
    setIsAndroidDevice(isAndroid() && isCapacitorNative());
  }, []);

  // Force permission request when component loads on Android
  useEffect(() => {
    const requestPermissionsOnLoad = async () => {
      if (isAndroid() && isCapacitorNative()) {
        try {
          console.log('🔑 Preemptively requesting storage permissions on page load');
          const { Filesystem } = await import('@capacitor/filesystem');
          await Filesystem.requestPermissions();
          setAndroidPermissionAttempted(true);
        } catch (error) {
          console.error('Error requesting permissions on load:', error);
        }
      }
    };
    
    requestPermissionsOnLoad();
  }, []);

  const handleHistoryClick = (fileName: string, type: string, data: any[], fullPath?: string) => {
    if (type === 'PDF') {
      downloadPDF(data, fileName.replace('.pdf', ''));
    } else {
      downloadCSV(data, fileName.replace('.csv', ''));
    }
    
    if (fullPath) {
      console.log(`Full file path: ${fullPath}`);
    }
  };

  const forceRequestPermission = async () => {
    if (!isAndroidDevice) return;
    
    try {
      setIsLoading(true);
      console.log('🔑 Manually triggering permission request');
      const { Filesystem } = await import('@capacitor/filesystem');
      const { Toast } = await import('@capacitor/toast');
      
      // Show toast before requesting permission
      await Toast.show({
        text: 'Please grant storage permissions when prompted',
        duration: 'long'
      });
      
      // Request permissions explicitly
      const result = await Filesystem.requestPermissions();
      console.log('Manual permission request result:', result);
      
      setAndroidPermissionAttempted(true);
      
      if (result.publicStorage === 'granted') {
        toast({
          title: 'Storage Permission Granted',
          description: 'You can now export files to your device',
        });
      } else {
        toast({
          title: 'Permission Required',
          description: 'Storage permission is needed to save files. Please enable it in app settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    } finally {
      setIsLoading(false);
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
        
        data.push(...filteredTransactions.map(tx => ({
          ...tx,
          date: format(new Date(tx.date), 'yyyy-MM-dd'),
        })));
      }
      
      if (dataType === 'all' || dataType === 'portfolio') {
        const portfolio = await getPortfolioSummary(currentUser.id);
        data.push(...portfolio);
      }
      
      if (dataType === 'all' || dataType === 'summaries') {
        const reports = await getProfitLossReport(currentUser.id, startDate, endDate);
        if (reports.daily.length) {
          data.push(...reports.daily.map(day => ({
            ...day,
            date: format(new Date(day.date), 'yyyy-MM-dd')
          })));
        }
        if (reports.stocks.length) {
          data.push(...reports.stocks.map(stock => ({
            ticker: stock.stock?.ticker || 'Unknown',
            name: stock.stock?.name || 'Unknown Stock',
            profit: stock.profit,
            loss: stock.loss,
            netProfit: stock.net,
            currency: stock.stock?.currency || 'USD'
          })));
        }
      }
      
      if (data.length === 0) {
        toast({
          title: 'No Data',
          description: 'There is no data to export for the selected period and type.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Reset the global file path variable before export
      window.lastGeneratedFilePath = undefined;
      
      // Show toast specifically for Android users about permission
      if (isAndroidDevice) {
        toast({
          title: 'Storage Permission',
          description: 'Please grant storage access when prompted',
        });
      }
      
      let exportSuccess = false;
      if (exportType === 'csv') {
        exportSuccess = await downloadCSV(data, fileName);
      } else {
        exportSuccess = await downloadPDF(data, fileName, currentUser?.username || currentUser?.email || "User");
      }
      
      // Small delay to ensure file operation completes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (exportSuccess) {
        // On Android, show additional information about file location
        if (isAndroidDevice && window.lastGeneratedFilePath) {
          toast({
            title: 'Export Successful',
            description: `File saved to: ${window.lastGeneratedFilePath}`,
          });
        }
        
        const newExportHistory = [
          ...exportHistory,
          {
            type: exportType.toUpperCase(),
            dataType: dataType,
            date: new Date(),
            fileName: `${fileName}.${exportType}`,
            fullPath: window.lastGeneratedFilePath,
            data: data
          }
        ];
        setExportHistory(newExportHistory);
        
        toast({
          title: 'Export Successful',
          description: `Your data has been exported as ${fileName}.${exportType}`,
        });
      }
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

            {isAndroidDevice && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 mr-3" />
                  <div>
                    <p className="font-medium text-amber-800">Android Storage Access</p>
                    <p className="mt-1 text-amber-700">
                      Android 10+ requires explicit storage permission. If files aren't saving, 
                      try the button below to request storage access.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2 bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300"
                      onClick={forceRequestPermission}
                      disabled={isLoading}
                    >
                      Request Storage Permission
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <Button
                className="w-full sm:w-auto"
                onClick={handleExport}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
                    onClick={() => handleHistoryClick(export_.fileName, export_.type, export_.data, export_.fullPath)}
                  >
                    <div>
                      <p className="font-medium">{export_.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(export_.date, "MMM dd, yyyy HH:mm")} - {export_.dataType}
                      </p>
                      {export_.fullPath && (
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          Path: {export_.fullPath}
                        </p>
                      )}
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
