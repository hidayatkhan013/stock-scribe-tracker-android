// Use dynamic imports for Capacitor modules to prevent build issues
// These types are just for TypeScript and won't be included in the final bundle
type FilesystemPlugin = {
  writeFile: (options: {
    path: string;
    data: string;
    directory: any;
    encoding: any;
  }) => Promise<any>;
  getUri: (options: {
    path: string;
    directory: any;
  }) => Promise<{ uri: string }>;
  mkdir: (options: {
    path: string;
    directory: any;
    recursive: boolean;
  }) => Promise<void>;
  checkPermissions: () => Promise<{ publicStorage: string }>;
  requestPermissions: () => Promise<{ publicStorage: string }>;
};

type ToastPlugin = {
  show: (options: { text: string; duration: "long" | "short" }) => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
};

// Add a global variable to store the last generated file path
declare global {
  interface Window {
    lastGeneratedFilePath?: string;
  }
}

/**
 * Detects if the application is running on an Android device
 */
export const isAndroid = (): boolean => {
  return (typeof (window as any).Capacitor !== 'undefined' && 
    (window as any).Capacitor.getPlatform() === 'android') || 
    (window.navigator && 
    window.navigator.userAgent && 
    window.navigator.userAgent.includes('Android'));
};

/**
 * Checks if the Capacitor runtime is available (running as native app)
 */
export const isCapacitorNative = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined' && 
    (window as any).Capacitor.isNativePlatform();
};

// Function to dynamically load Capacitor Filesystem plugin
const getFilesystem = async (): Promise<FilesystemPlugin | null> => {
  if (isCapacitorNative()) {
    try {
      const capacitorModule = await import('@capacitor/filesystem');
      return capacitorModule.Filesystem;
    } catch (error) {
      console.error('Error loading Filesystem plugin:', error);
      return null;
    }
  }
  return null;
};

// Function to dynamically load Capacitor Toast plugin
const getToast = async (): Promise<ToastPlugin | null> => {
  if (isCapacitorNative()) {
    try {
      const toastModule = await import('@capacitor/toast');
      return toastModule.Toast;
    } catch (error) {
      console.error('Error loading Toast plugin:', error);
      return null;
    }
  }
  return null;
};

/**
 * Checks and requests storage permissions on Android
 */
const ensureStoragePermissions = async (): Promise<boolean> => {
  if (!isAndroid() || !isCapacitorNative()) return true;

  try {
    const Filesystem = await getFilesystem();
    if (!Filesystem) return false;

    console.log('Checking and requesting storage permissions...');
    
    // Request permissions first - more reliable approach for Android 10+
    try {
      const requestResult = await Filesystem.requestPermissions();
      console.log('Permission request result:', requestResult);
      
      // Force a second request if needed
      if (requestResult.publicStorage !== 'granted') {
        console.log('Permissions not granted on first attempt, trying again...');
        const secondAttempt = await Filesystem.requestPermissions();
        console.log('Second permission request result:', secondAttempt);
        return secondAttempt.publicStorage === 'granted';
      }
      
      return requestResult.publicStorage === 'granted';
    } catch (err) {
      console.error('Error requesting permissions:', err);
      // If request fails, check current status
      const permissionStatus = await Filesystem.checkPermissions();
      console.log('Current permission status:', permissionStatus);
      return permissionStatus.publicStorage === 'granted';
    }
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
};

/**
 * Creates directory path if it doesn't exist
 */
const ensureDirectoryExists = async (path: string, directory: string): Promise<boolean> => {
  try {
    const Filesystem = await getFilesystem();
    if (!Filesystem) return false;

    await Filesystem.mkdir({
      path,
      directory,
      recursive: true
    });
    console.log(`Directory created: ${directory}/${path}`);
    return true;
  } catch (error) {
    // Directory might already exist, which is fine
    console.log('Directory exists or error creating:', error);
    return true;
  }
};

/**
 * Gets the appropriate file save location for Android
 */
const getAndroidSaveLocation = async (fileName: string, ext: string): Promise<{
  path: string;
  directory: string;
  displayPath: string;
}> => {
  // First, try to ensure we have permissions
  const hasPermissions = await ensureStoragePermissions();
  console.log('Has storage permissions:', hasPermissions);
  
  // For Android 10+ (API 29+), we'll use different strategies based on what's available
  if (hasPermissions) {
    try {
      // For Android 10+ we try to save to Download directory
      console.log('Attempting to save to Downloads folder with permissions');
      await ensureDirectoryExists('Download/StockScribe', 'EXTERNAL');
      return {
        path: `Download/StockScribe/${fileName}.${ext}`,
        directory: 'EXTERNAL',
        displayPath: `Download/StockScribe/${fileName}.${ext}`
      };
    } catch (error) {
      console.error('Error setting up Download folder:', error);
      // Fall back to external files directory if Download isn't working
      console.log('Falling back to EXTERNAL_FILES directory');
      await ensureDirectoryExists('StockScribe', 'EXTERNAL_FILES');
      return {
        path: `StockScribe/${fileName}.${ext}`,
        directory: 'EXTERNAL_FILES',
        displayPath: `Files/StockScribe/${fileName}.${ext}`
      };
    }
  } else {
    // If we don't have permissions or on older Android, use app-specific location
    console.log('Using app-specific document directory as fallback');
    const appFolderPath = 'StockScribe';
    await ensureDirectoryExists(appFolderPath, 'DOCUMENTS');
    return {
      path: `${appFolderPath}/${fileName}.${ext}`,
      directory: 'DOCUMENTS',
      displayPath: `App Documents/${appFolderPath}/${fileName}.${ext}`
    };
  }
};

/**
 * Downloads a CSV file
 * @param data Data to be saved to CSV
 * @param fileName Name of the file without extension
 */
export const downloadCSV = async (data: any[], fileName: string): Promise<boolean> => {
  if (!data.length) {
    return false;
  }
  
  try {
    // Ensure all objects have the same keys by taking a union of all keys
    const allKeys = new Set<string>();
    data.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);
    let csvContent = headers.join(',') + '\n';
    data.forEach(item => {
      const row = headers.map(header => {
        const cellValue = item[header] !== undefined ? item[header] : '';
        if (cellValue === null) return '';
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

    // For Android native app, use Capacitor Filesystem
    if (isAndroid() && isCapacitorNative()) {
      try {
        console.log('Saving CSV file on Android...');
        const Filesystem = await getFilesystem();
        const Toast = await getToast();

        if (!Filesystem) throw new Error('Filesystem plugin not available');
        
        // Get the appropriate save location
        const saveLocation = await getAndroidSaveLocation(fileName, "csv");
        console.log('Save location determined:', saveLocation);

        // Write the file
        console.log(`Writing file to ${saveLocation.directory}/${saveLocation.path}`);
        await Filesystem.writeFile({
          path: saveLocation.path,
          data: csvContent,
          directory: saveLocation.directory,
          encoding: 'UTF8'
        });

        // Get full URI for the saved file
        console.log('Getting file URI...');
        const fileInfo = await Filesystem.getUri({
          path: saveLocation.path,
          directory: saveLocation.directory
        });

        // Set the global variable with the full file path
        window.lastGeneratedFilePath = fileInfo.uri;

        // Enhanced logging with more context
        console.log(`CSV File Generated: ${fileName}`);
        console.log(`Save Directory: ${saveLocation.directory}`);
        console.log(`Full File Path: ${fileInfo.uri}`);

        if (Toast) {
          await Toast.show({
            text: `File saved to ${saveLocation.displayPath}`,
            duration: 'long'
          });
        }

        return true;
      } catch (error) {
        console.error('Android file write error:', error);
        const Toast = await getToast();
        if (Toast) {
          await Toast.show({
            text: `Error saving file: ${(error as Error).message}`,
            duration: 'long'
          });
        }
        // Fall back to browser download if native save fails
        return downloadBrowserFile(csvContent, `${fileName}.csv`, 'text/csv;charset=utf-8;');
      }
    } else {
      // For web browser
      return downloadBrowserFile(csvContent, `${fileName}.csv`, 'text/csv;charset=utf-8;');
    }
  } catch (error) {
    console.error('CSV generation error:', error);
    return false;
  }
};

/**
 * Downloads a PDF-like HTML file styled as requested
 * @param data Data to be saved to PDF
 * @param fileName Name of the file without extension
 * @param username Optional username to show at the top
 */
export const downloadPDF = async (
  data: any[],
  fileName: string,
  username?: string
): Promise<boolean> => {
  if (!data.length) return false;

  // Summaries and calculations for the header
  const totalBuy = data
    .filter((d) => d.type === 'buy' || d.type === 'Buy')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalSell = data
    .filter((d) => d.type === 'sell' || d.type === 'Sell')
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const netProfit = totalSell - totalBuy;

  // Today's info
  const now = new Date();
  const formattedNow = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " +
      now.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' });

  // Determine unique columns based on data
  const columns = ['date', 'type', 'details', 'shares', 'price', 'amount'];
  const columnLabels: Record<string, string> = {
    date: "Date",
    type: "Type",
    details: "Details",
    shares: "Shares",
    price: "Price",
    amount: "Amount",
  };

  // Template with proper formatting and calculations
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${fileName}</title>
        <meta charset="utf-8">
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; color-adjust: exact; }
          }
          body { background: #f8f9fc; font-family: 'Segoe UI', Arial, sans-serif; color: #232136; margin:0; padding:0; }
          .report-container { margin: 20px auto; padding: 25px; background: #fff; max-width: 800px; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.08); }
          .report-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eaeaea; }
          .report-title { color: #4040b2; font-weight: 700; font-size: 1.8rem; margin: 0; }
          .user-subtitle { color: #5c5877; font-size: 1.1rem; margin: 8px 0 20px 0; }
          .report-date { color: #7c7a8c; font-size: 0.9rem; text-align: right; }
          .summary-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .summary-box { flex: 1; margin: 0 10px; padding: 12px 15px; border-radius: 8px; }
          .buy-box { background: #f0f7ff; border: 1px solid #d0e3ff; }
          .sell-box { background: #f7fff0; border: 1px solid #e3ffd0; }
          .profit-box { background: #fff0f9; border: 1px solid #ffd0e8; }
          .summary-label { font-size: 0.9rem; color: #555; margin-bottom: 5px; font-weight: 500; }
          .summary-value { font-size: 1.3rem; font-weight: 700; }
          .buy-value { color: #0055cc; }
          .sell-value { color: #2a9d00; }
          .profit-value { color: #cc0055; }
          table { width: 100%; border-collapse: collapse; background: #fff; margin-bottom: 15px; border: 1px solid #e5e5f5; }
          th { background: #f0f2ff; color: #4040b2; font-weight: 600; text-align: left; padding: 12px 10px; border-bottom: 2px solid #d8d8ff; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background: #f9faff; }
          .type-buy { color: #0055cc; font-weight: 600; }
          .type-sell { color: #2a9d00; font-weight: 600; }
          .footer { margin-top: 20px; color: #9b87f5; font-size: 0.8rem; text-align: right; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="report-header">
            <div>
              <h1 class="report-title">Stock Transaction Report</h1>
              <div class="user-subtitle">${username || "User"}</div>
            </div>
            <div class="report-date">
              Generated: ${formattedNow}
            </div>
          </div>
          
          <div class="summary-container">
            <div class="summary-box buy-box">
              <div class="summary-label">Total Buy</div>
              <div class="summary-value buy-value">${totalBuy.toFixed(2)}</div>
            </div>
            <div class="summary-box sell-box">
              <div class="summary-label">Total Sell</div>
              <div class="summary-value sell-value">${totalSell.toFixed(2)}</div>
            </div>
            <div class="summary-box profit-box">
              <div class="summary-label">Net Profit/Loss</div>
              <div class="summary-value profit-value">${netProfit.toFixed(2)}</div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                ${columns.map(col => `<th>${columnLabels[col]}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  <td>${row.date || ""}</td>
                  <td class="type-${row.type && row.type.toLowerCase()}">
                    ${row.type || ""}
                  </td>
                  <td>${row.details || row.note || row.description || ""}</td>
                  <td class="text-center">${row.shares !== undefined ? row.shares : ""}</td>
                  <td class="text-right">${row.price !== undefined ? row.price : ""}</td>
                  <td class="text-right">${row.amount !== undefined ? row.amount : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <div class="footer">
            StockScribe - Your personal stock trading tracker
          </div>
        </div>
      </body>
    </html>
  `;

  // Android native file save with .html as "PDF"
  if (isAndroid() && isCapacitorNative()) {
    try {
      console.log('Saving HTML/PDF file on Android...');
      const Filesystem = await getFilesystem();
      const Toast = await getToast();

      if (!Filesystem) throw new Error('Filesystem plugin not available');

      // Get the appropriate save location
      const saveLocation = await getAndroidSaveLocation(fileName, "html");
      console.log('Save location determined:', saveLocation);

      // Write the file
      console.log(`Writing file to ${saveLocation.directory}/${saveLocation.path}`);
      await Filesystem.writeFile({
        path: saveLocation.path,
        data: htmlContent,
        directory: saveLocation.directory,
        encoding: 'UTF8'
      });

      // Get full URI for the saved file
      console.log('Getting file URI...');
      const fileInfo = await Filesystem.getUri({
        path: saveLocation.path,
        directory: saveLocation.directory
      });

      // Set the global variable with the full file path
      window.lastGeneratedFilePath = fileInfo.uri;

      // Enhanced logging with more context
      console.log(`PDF File Generated: ${fileName}`);
      console.log(`Save Directory: ${saveLocation.directory}`);
      console.log(`Full File Path: ${fileInfo.uri}`);

      if (Toast) {
        await Toast.show({
          text: `File saved to ${saveLocation.displayPath}`,
          duration: "long"
        });
      }
      
      return true;
    } catch (error) {
      console.error('Android file write error:', error);
      const Toast = await getToast();
      if (Toast) {
        await Toast.show({
          text: `Error saving file: ${(error as Error).message}`,
          duration: 'long'
        });
      }
      // Fall back to browser download
      return downloadBrowserFile(htmlContent, `${fileName}.html`, 'text/html');
    }
  } else {
    // For web browsers, download as .html file instead of opening in new tab
    return downloadBrowserFile(htmlContent, `${fileName}.html`, 'text/html');
  }
};

/**
 * Helper function to download a file in the browser
 */
const downloadBrowserFile = (content: string, fileName: string, mimeType: string): boolean => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
};
