
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
  show: (options: { text: string; duration: "long" | "short" }) => Promise<void>;
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
 * Helper function to get the Download path for Android
 */
const getAndroidDownloadPath = (fileName: string, ext: string) => {
  // Always save in Download folder on Android
  return `Download/${fileName}.${ext}`;
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

        if (!Filesystem) throw new Error('Filesystem plugin not available');

        await Filesystem.writeFile({
          path: getAndroidDownloadPath(fileName, "csv"),
          data: csvContent,
          directory: 'EXTERNAL',
          encoding: 'UTF8'
        });

        if (Toast) {
          await Toast.show({
            text: `File saved to Download/${fileName}.csv`,
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
  if (!data.length) {
    return false;
  }

  // Basic calculations for demo, you should replace with your business logic
  const totalDebit = data.filter(d => d.debit).reduce((sum, d) => sum + Number(d.debit ?? 0), 0);
  const totalCredit = data.filter(d => d.credit).reduce((sum, d) => sum + Number(d.credit ?? 0), 0);
  const openingBalance = 0;
  const grandTotal = totalCredit - totalDebit;
  const runningBalance = openingBalance + grandTotal;

  // Grab today's info
  const now = new Date();
  const formattedNow = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " +
    now.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' });

  // Compose HTML (customized to your image)
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${fileName}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin:0; padding:0; color:#111 }
          h1 { text-align: center; margin: 24px 4px 4px 4px; font-size: 2rem; }
          .report-meta { text-align: center; color: #888; margin-bottom: 10px; }
          .summary-card { display: flex; justify-content: space-between; border: 1px solid #aaa; border-radius:8px; padding:16px; margin-bottom:20px; }
          .summary-stat { flex:1; text-align:center; }
          .summary-stat:not(:last-child) { border-right: 1px solid #eee;}
          .summary-title { font-size: 0.9rem; color: #777;}
          .summary-value { font-size:1.1rem; }
          .summary-credit { color: #056e05; }
          .summary-debit { color: #e12d2d; }
          .summary-balance { color:#3D3; }
          .entries { margin-top: 24px; }
          .entries-title { font-weight: 600; font-size: 1rem; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1rem;}
          th, td { border: 1px solid #ddd; padding: 7px 9px; text-align: left; font-size:0.96rem }
          th { background: #f3f3f5; }
          td.debit  { background: #ffecec; }
          td.credit { background: #e9ffef; }
          td.debit, .summary-debit, .debit-balance { color: #e12d2d; font-weight:bold; }
          td.credit, .summary-credit { color: #056e05; font-weight: bold; }
          .grand-total { font-weight: 700; font-size:1.05rem; color:#111; background: #fafafb }
          .footer { font-size:13px; color:#222; margin-top:20px; margin-left:10px }
        </style>
      </head>
      <body>
        <h1>${username || "StockScribe User"} Statement</h1>
        <div class="report-meta">
          <!-- Additional meta, like phone number or date range, can go here -->
        </div>
        <div class="summary-card">
          <div class="summary-stat">
            <div class="summary-title">Opening Balance</div>
            <div class="summary-value">${openingBalance} <span>﷼</span></div>
            <div class="summary-title">(settled)</div>
          </div>
          <div class="summary-stat">
            <div class="summary-title">Total Debit (-)</div>
            <div class="summary-value summary-debit">${totalDebit.toLocaleString()} <span>﷼</span></div>
          </div>
          <div class="summary-stat">
            <div class="summary-title">Total Credit (+)</div>
            <div class="summary-value summary-credit">${totalCredit.toLocaleString()} <span>﷼</span></div>
          </div>
          <div class="summary-stat">
            <div class="summary-title">Net Balance</div>
            <div class="summary-value summary-balance">${grandTotal} <span>﷼</span></div>
          </div>
          <div class="summary-stat">
            <div class="summary-title">Running Balance</div>
            <div class="summary-value">${runningBalance} <span>﷼</span></div>
          </div>
        </div>
        <div class="entries">
          <div class="entries-title">No. of Entries: ${data.length} (All)</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Details</th>
                <th>Debit (-)</th>
                <th>Credit (+)</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row) => `
                <tr>
                  <td>${row.date || ''}</td>
                  <td>${row.details || ''}</td>
                  <td class="debit">${row.debit || ''}</td>
                  <td class="credit">${row.credit || ''}</td>
                  <td class="${Number(row.balance) < 0 ? 'debit-balance' : ''}">${row.balance || ''}</td>
                </tr>
              `).join('')}
              <tr class="grand-total">
                <td colspan="2">Grand Total</td>
                <td>${totalDebit.toLocaleString()} ﷼</td>
                <td>${totalCredit.toLocaleString()} ﷼</td>
                <td>${grandTotal} ﷼</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="footer">
          Report Generated : ${formattedNow}
        </div>
      </body>
    </html>
  `;

  if (isAndroid() && isCapacitorNative()) {
    try {
      const Filesystem = await getFilesystem();
      const Toast = await getToast();

      if (!Filesystem) throw new Error('Filesystem plugin not available');

      await Filesystem.writeFile({
        path: getAndroidDownloadPath(fileName, "html"),
        data: htmlContent,
        directory: 'EXTERNAL',
        encoding: 'UTF8'
      });

      if (Toast) {
        await Toast.show({
          text: `File saved to Download/${fileName}.html`,
          duration: "long" // Changed from string to "long" | "short" type
        });
      }
      return true;
    } catch (error) {
      console.error('Android file write error:', error);
      return openHtmlInBrowser(htmlContent, fileName);
    }
  } else {
    // For web browsers, open in a new tab
    return openHtmlInBrowser(htmlContent, fileName);
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
