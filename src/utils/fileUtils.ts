
// Use dynamic imports for Capacitor modules to prevent build issues
// These types are just for TypeScript and won't be included in the final bundle
type FilesystemPlugin = {
  writeFile: (options: {
    path: string;
    data: string;
    directory: any;
    encoding: any;
  }) => Promise<any>;
};

type ToastPlugin = {
  show: (options: { text: string; duration: string }) => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform: () => boolean;
};

/**
 * Detects if the application is running on an Android device
 */
export const isAndroid = (): boolean => {
  return window.navigator && 
    window.navigator.userAgent && 
    window.navigator.userAgent.includes('Android');
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
        const Filesystem = await getFilesystem();
        const Toast = await getToast();
        
        if (!Filesystem) {
          throw new Error('Filesystem plugin not available');
        }
        
        await Filesystem.writeFile({
          path: `${fileName}.csv`,
          data: csvContent,
          directory: 'DOCUMENTS', // Use string instead of enum
          encoding: 'UTF8'        // Use string instead of enum
        });
        
        if (Toast) {
          await Toast.show({
            text: `File saved to Documents/${fileName}.csv`,
            duration: 'long'
          });
        }
        
        return true;
      } catch (error) {
        console.error('Android file write error:', error);
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
 * Downloads a PDF file
 * @param data Data to be saved to PDF
 * @param fileName Name of the file without extension
 */
export const downloadPDF = async (data: any[], fileName: string): Promise<boolean> => {
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
      <!DOCTYPE html>
      <html>
        <head>
          <title>${fileName}</title>
          <meta charset="utf-8">
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
          <h1>StockScribe - Export</h1>
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
            Generated by StockScribe on ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `;
    
    // For Android native app, use Capacitor Filesystem
    if (isAndroid() && isCapacitorNative()) {
      try {
        const Filesystem = await getFilesystem();
        const Toast = await getToast();
        
        if (!Filesystem) {
          throw new Error('Filesystem plugin not available');
        }
        
        await Filesystem.writeFile({
          path: `${fileName}.html`,
          data: htmlContent,
          directory: 'DOCUMENTS', // Use string instead of enum
          encoding: 'UTF8'        // Use string instead of enum
        });
        
        if (Toast) {
          await Toast.show({
            text: `File saved to Documents/${fileName}.html`,
            duration: 'long'
          });
        }
        
        return true;
      } catch (error) {
        console.error('Android file write error:', error);
        // Fall back to browser method if native save fails
        return openHtmlInBrowser(htmlContent, fileName);
      }
    } else {
      // For web browsers, open the PDF directly in a new tab
      return openHtmlInBrowser(htmlContent, fileName);
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    return false;
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

/**
 * Helper function to open HTML content in a new browser tab
 */
const openHtmlInBrowser = (htmlContent: string, fileName: string): boolean => {
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  return true;
};
