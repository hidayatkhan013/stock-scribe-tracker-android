
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

const Export = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'pdf'>('csv');
  const [dataType, setDataType] = useState<'all' | 'transactions' | 'portfolio' | 'summaries'>('all');
  const [startDate, setStartDate] = useState<Date>(subMonths(new Date(), 3));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const handleExport = () => {
    setIsLoading(true);
    
    // Simulate export process
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: 'Export Queued',
        description: 'Your export is being prepared and will be available soon.',
      });
    }, 1500);
  };

  return (
    <AppLayout title="Export Data">
      <div className="max-w-2xl mx-auto">
        <Card>
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
                <SelectTrigger id="exportType">
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
                <SelectTrigger id="dataType">
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

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Export History</CardTitle>
            <CardDescription>
              Your recent data exports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              No previous exports found
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Export;
