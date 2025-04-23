
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { testCapacitorPermissions, isAndroid, isCapacitorNative } from '@/utils/fileUtils';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Smartphone } from 'lucide-react';

/**
 * A component to test Capacitor functionality that can be placed anywhere in the app
 */
const CapacitorTester: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isRunningOnAndroid = isAndroid() && isCapacitorNative();
  const [capacitorReady, setCapacitorReady] = useState(false);

  // Check if Capacitor is ready
  useEffect(() => {
    const checkCapacitorStatus = async () => {
      try {
        // Simple check to see if Capacitor modules can be imported
        const { Capacitor } = await import('@capacitor/core');
        setCapacitorReady(true);
        console.log('Capacitor is ready to use');
      } catch (error) {
        console.error('Error loading Capacitor modules:', error);
        setCapacitorReady(false);
      }
    };
    
    checkCapacitorStatus();
  }, []);

  // If not running on Android, don't show the component
  if (!isRunningOnAndroid) {
    return null;
  }

  const handleTestPermissions = async () => {
    setLoading(true);
    try {
      console.log('Starting Capacitor permissions test');
      
      if (!capacitorReady) {
        toast({
          title: 'Capacitor Not Ready',
          description: 'The Capacitor plugins failed to load. Please check console for errors.',
          variant: 'destructive',
        });
        return;
      }
      
      const result = await testCapacitorPermissions();
      
      if (result.success) {
        toast({
          title: 'Capacitor Test Successful',
          description: result.message,
        });
      } else {
        toast({
          title: 'Capacitor Test Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing Capacitor:', error);
      toast({
        title: 'Capacitor Test Error',
        description: `Unexpected error: ${error.message || String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg shadow my-4">
      <div className="flex flex-col space-y-4">
        <div className="flex items-start space-x-2">
          <Smartphone className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-amber-800">Android Storage Permissions</h3>
            <p className="text-sm text-amber-700">
              Test Capacitor storage permissions directly from this screen.
            </p>
            {!capacitorReady && (
              <p className="text-xs text-red-600 mt-1">
                Warning: Capacitor plugins failed to load. This may not work properly.
              </p>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 w-full sm:w-auto"
          onClick={handleTestPermissions}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Capacitor Permissions"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CapacitorTester;
