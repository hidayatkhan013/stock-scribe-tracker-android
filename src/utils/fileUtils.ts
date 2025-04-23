
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
      console.log('Loading Filesystem plugin...');
      const capacitorModule = await import('@capacitor/filesystem');
      console.log('Filesystem plugin loaded successfully', capacitorModule.Filesystem);
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
      console.log('Toast plugin loaded successfully');
      return toastModule.Toast;
    } catch (error) {
      console.error('Error loading Toast plugin:', error);
      return null;
    }
  }
  return null;
};

/**
 * CRITICAL: Explicitly request storage permissions for Android
 * This function force-requests permissions multiple times with delays
 */
const ensureStoragePermissions = async (): Promise<boolean> => {
  if (!isAndroid() || !isCapacitorNative()) return true;

  try {
    const Filesystem = await getFilesystem();
    if (!Filesystem) {
      console.error('Filesystem plugin not available for permissions');
      return false;
    }

    console.log('⚠️ ACTIVELY REQUESTING STORAGE PERMISSIONS...');
    
    // First check current permissions
    const checkResult = await Filesystem.checkPermissions();
    console.log('Initial permission status:', checkResult);
    
    if (checkResult.publicStorage !== 'granted') {
      // First request - CRITICAL for Android 10
      console.log('🔴 Permissions not granted, making FIRST explicit request...');
      const Toast = await getToast();
      if (Toast) {
        await Toast.show({
          text: 'Please grant storage permissions to save files',
          duration: 'long'
        });
      }
      
      const requestResult = await Filesystem.requestPermissions();
      console.log('First permission request result:', requestResult);
      
      // For Android 10+, we need multiple permission requests
      if (requestResult.publicStorage !== 'granted') {
        console.log('🔴 Permissions not granted on first attempt, making SECOND request after delay...');
        
        // Show toast before second attempt
        if (Toast) {
          await Toast.show({
            text: 'Storage access is required - please grant permissions',
            duration: 'long'
          });
        }
        
        // Add delay before second attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
        const secondAttempt = await Filesystem.requestPermissions();
        console.log('Second permission request result:', secondAttempt);
        
        // If still not granted, try one final time with longer delay
        if (secondAttempt.publicStorage !== 'granted') {
          console.log('🔴 Permissions STILL not granted, making FINAL attempt after longer delay...');
          
          // Show toast before final attempt
          if (Toast) {
            await Toast.show({
              text: 'Final attempt: Please grant storage permissions now',
              duration: 'long'
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          const finalAttempt = await Filesystem.requestPermissions();
          console.log('Final permission request result:', finalAttempt);
          
          if (finalAttempt.publicStorage !== 'granted') {
            console.log('⛔ All permission attempts failed - will try to save anyway');
            return false;
          }
          
          return finalAttempt.publicStorage === 'granted';
        }
        
        return secondAttempt.publicStorage === 'granted';
      }
      
      return requestResult.publicStorage === 'granted';
    }
    
    console.log('✅ Storage permissions already granted');
    return checkResult.publicStorage === 'granted';
  } catch (error) {
    console.error('Permission check/request failed:', error);
    // Even if permission checks fail, we'll try to write anyway
    return true;
  }
};

/**
 * Creates directory path if it doesn't exist
 */
const ensureDirectoryExists = async (path: string, directory: string): Promise<boolean> => {
  try {
    const Filesystem = await getFilesystem();
    if (!Filesystem) return false;

    console.log(`Creating directory if needed: ${directory}/${path}`);

    await Filesystem.mkdir({
      path,
      directory,
      recursive: true
    });
    console.log(`✅ Directory created: ${directory}/${path}`);
    return true;
  } catch (error) {
    // Directory might already exist, which is fine
    console.log('Directory exists or error creating:', error);
    return true;
  }
};

/**
 * Tries multiple save locations for Android files
 * Returns the first successful location or falls back to app documents
 * Optimized for Android 10+ compatibility
 */
const getAndroidSaveLocation = async (fileName: string, ext: string): Promise<{
  path: string;
  directory: string;
  displayPath: string;
}> => {
  // First, force permissions check/request
  const permissionsGranted = await ensureStoragePermissions();
  console.log('Storage permissions check completed, granted:', permissionsGranted);
  
  // Try various Android storage options in order of preference
  const saveLocations = [
    // First try: Download folder with no subfolder (most compatible for Android 10)
    {
      try: async () => {
        console.log('🔍 ATTEMPT 1: Trying to save directly to Downloads folder (best for Android 10)');
        return {
          path: `${fileName}.${ext}`, // No subfolder
          directory: 'EXTERNAL_STORAGE',
          displayPath: `Downloads/${fileName}.${ext}`
        };
      }
    },
    // Second try: Download in external storage (preferred for modern Android)
    {
      try: async () => {
        console.log('🔍 ATTEMPT 2: Trying to save to Downloads folder in external storage');
        await ensureDirectoryExists('Download', 'EXTERNAL');
        return {
          path: `Download/${fileName}.${ext}`,
          directory: 'EXTERNAL',
          displayPath: `Download/${fileName}.${ext}`
        };
      }
    },
    // Third try: External directory root (simpler path for Android 10)
    {
      try: async () => {
        console.log('🔍 ATTEMPT 3: Trying to save to external storage root');
        return {
          path: `${fileName}.${ext}`,
          directory: 'EXTERNAL',
          displayPath: `External Storage/${fileName}.${ext}`
        };
      }
    },
    // Fourth try: Documents in external storage
    {
      try: async () => {
        console.log('🔍 ATTEMPT 4: Trying to save to Documents folder in external storage');
        await ensureDirectoryExists('Documents', 'EXTERNAL');
        return {
          path: `Documents/${fileName}.${ext}`,
          directory: 'EXTERNAL',
          displayPath: `Documents/${fileName}.${ext}`
        };
      }
    },
    // Fifth try: External files directory (For Android 10+)
    {
      try: async () => {
        console.log('🔍 ATTEMPT 5: Trying to save to external files directory');
        return {
          path: `${fileName}.${ext}`,
          directory: 'EXTERNAL_FILES',
          displayPath: `Files/${fileName}.${ext}`
        };
      }
    },
    // Final fallback: App-specific documents (most compatible fallback)
    {
      try: async () => {
        console.log('🔍 FALLBACK: Using app-specific documents directory');
        return {
          path: `${fileName}.${ext}`,
          directory: 'DOCUMENTS',
          displayPath: `App Documents/${fileName}.${ext}`
        };
      }
    }
  ];
  
  // Try each location until one works
  for (const location of saveLocations) {
    try {
      const result = await location.try();
      console.log('✅ Successfully determined save location:', result);
      return result;
    } catch (error) {
      console.error('Failed with this location, trying next:', error);
    }
  }
  
  // Final fallback if all else fails - use app's document directory
  console.log('⚠️ All location attempts failed, using base app documents');
  return {
    path: `${fileName}.${ext}`,
    directory: 'DOCUMENTS',
    displayPath: `App Documents/${fileName}.${ext}`
  };
};

/**
 * Downloads a CSV file
 * @param data Data to be saved to CSV
 * @param fileName Name of the file without extension
 */
export const downloadCSV = async (data: any[], fileName: string): Promise<boolean> => {
  if (!data.length) {
    console.log('No data to export');
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
        console.log('📝 Starting CSV file save on Android...');
        const Filesystem = await getFilesystem();
        const Toast = await getToast();

        if (!Filesystem) {
          console.error('Filesystem plugin not available');
          throw new Error('Filesystem plugin not available');
        }
        
        // Force permission request before trying to save
        console.log('🔑 Requesting storage permissions before save...');
        await ensureStoragePermissions();
        
        // Get the appropriate save location
        console.log('📁 Determining optimal save location...');
        const saveLocation = await getAndroidSaveLocation(fileName, "csv");
        console.log('Save location determined:', saveLocation);

        // Write the file
        console.log(`✏️ Writing file to ${saveLocation.directory}/${saveLocation.path}`);
        const writeResult = await Filesystem.writeFile({
          path: saveLocation.path,
          data: csvContent,
          directory: saveLocation.directory,
          encoding: 'UTF8'
        });
        
        console.log('Write result:', writeResult);

        // Get full URI for the saved file
        console.log('🔍 Getting file URI...');
        const fileInfo = await Filesystem.getUri({
          path: saveLocation.path,
          directory: saveLocation.directory
        });

        // Set the global variable with the full file path
        window.lastGeneratedFilePath = fileInfo.uri;
        console.log('🎯 Global path variable set to:', window.lastGeneratedFilePath);

        // Enhanced logging with more context
        console.log(`✅ CSV File Generated: ${fileName}`);
        console.log(`📂 Save Directory: ${saveLocation.directory}`);
        console.log(`📄 Full File Path: ${fileInfo.uri}`);

        if (Toast) {
          await Toast.show({
            text: `File saved to ${saveLocation.displayPath}`,
            duration: 'long'
          });
        }

        return true;
      } catch (error) {
        console.error('⛔ Android file write error:', error);
        const Toast = await getToast();
        if (Toast) {
          await Toast.show({
            text: `Error saving file: ${(error as Error).message}. Please check app permissions.`,
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
      console.log('📝 Starting HTML/PDF file save on Android...');
      const Filesystem = await getFilesystem();
      const Toast = await getToast();

      if (!Filesystem) throw new Error('Filesystem plugin not available');

      // Force permission request before trying to save
      console.log('🔑 Requesting storage permissions before save...');
      await ensureStoragePermissions();
      
      // Get the appropriate save location
      console.log('📁 Determining optimal save location...');
      const saveLocation = await getAndroidSaveLocation(fileName, "html");
      console.log('Save location determined:', saveLocation);

      // Write the file
      console.log(`✏️ Writing file to ${saveLocation.directory}/${saveLocation.path}`);
      const writeResult = await Filesystem.writeFile({
        path: saveLocation.path,
        data: htmlContent, // This comes from the existing code we kept
        directory: saveLocation.directory,
        encoding: 'UTF8'
      });
      
      console.log('Write result:', writeResult);

      // Get full URI for the saved file
      console.log('🔍 Getting file URI...');
      const fileInfo = await Filesystem.getUri({
        path: saveLocation.path,
        directory: saveLocation.directory
      });

      // Set the global variable with the full file path
      window.lastGeneratedFilePath = fileInfo.uri;
      console.log('🎯 Global path variable set to:', window.lastGeneratedFilePath);

      // Enhanced logging with more context
      console.log(`✅ PDF File Generated: ${fileName}`);
      console.log(`📂 Save Directory: ${saveLocation.directory}`);
      console.log(`📄 Full File Path: ${fileInfo.uri}`);

      if (Toast) {
        await Toast.show({
          text: `File saved to ${saveLocation.displayPath}`,
          duration: "long"
        });
      }
      
      return true;
    } catch (error) {
      console.error('⛔ Android file write error:', error);
      const Toast = await getToast();
      if (Toast) {
        await Toast.show({
          text: `Error saving file: ${(error as Error).message}. Please check app permissions.`,
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
