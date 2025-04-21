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
  if (!data.length) return false;

  // Summaries for the header (example: you may adjust)
  const totalBuy = data
    .filter((d) => d.type === 'Buy' && d.amount)
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const totalSell = data
    .filter((d) => d.type === 'Sell' && d.amount)
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);

  // Today's info
  const now = new Date();
  const formattedNow = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " | " +
      now.toLocaleDateString([], { day: '2-digit', month: 'short', year: '2-digit' });

  // Determine unique columns based on your data (for flexible table header)
  const columns = ['date', 'type', 'details', 'shares', 'price', 'amount'];
  const columnLabels: Record<string, string> = {
    date: "Date",
    type: "Type",
    details: "Details",
    shares: "Shares",
    price: "Price",
    amount: "Amount",
  };

  // Template inspired by screenshot: header, brand color, bold rows, totals in summary.
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${fileName}</title>
        <meta charset="utf-8">
        <style>
          body { background: #f8f9fc; font-family: 'Segoe UI', Arial, sans-serif; color: #232136; margin:0; padding:0;}
          .report-container { margin: 40px auto; padding: 32px; background: #fff; max-width: 800px; border-radius: 18px; box-shadow: 0 4px 30px rgba(34,36,38,0.06); }
          .report-title { color: #9b87f5; font-weight: 700; font-size: 2.1rem; letter-spacing: 0.5px; text-align: center; margin-bottom: 0.5em;}
          .user-subtitle { text-align: center; font-size:1.05rem; color: #5c5877; margin-bottom: 1em;}
          .meta { display: flex; justify-content: space-between; color: #7c7a8c; font-size: 1rem; margin-bottom: 16px; }
          .summary-box { display:flex; justify-content: center; gap: 32px; margin-bottom:22px;}
          .summary-stat { background: #eee8fd; border-radius: 10px; padding:10px 22px; display:flex; flex-direction:column; align-items:center; border:1.5px solid #e1e0e7;}
          .summary-label { color: #7a6ecb; font-size:0.96rem;}
          .summary-value { font-size:1.18rem; font-weight:600; color:#41338b;}
          table { width: 100%; border-collapse: collapse; background: #fcfcff; margin-bottom: 14px;}
          th, td { border: 1px solid #e5e5f5; padding: 10px 8px; font-size: 1.06rem; }
          th { background: #ede9fe; color:#6750d7; font-weight:700;}
          tr:nth-child(even) td { background: #f6f7fb; }
          tr.entry-row { transition: background .15s;}
          .entry-type-buy { color:#00a156; font-weight:600;}
          .entry-type-sell { color:#ea384c; font-weight:600;}
          .footer { margin-top:40px; color:#9b87f5; font-size:16px; text-align:right;}
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="report-title">
            Stock Statement
          </div>
          <div class="user-subtitle">${username ? username : "StockScribe User"}</div>
          <div class="meta">
            <div>Date: ${now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div>Entries: ${data.length}</div>
          </div>
          <div class="summary-box">
            <div class="summary-stat">
              <div class="summary-label">Total Buy</div>
              <div class="summary-value">${totalBuy.toLocaleString()}</div>
            </div>
            <div class="summary-stat">
              <div class="summary-label">Total Sell</div>
              <div class="summary-value">${totalSell.toLocaleString()}</div>
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
                <tr class="entry-row">
                  <td>${row.date ? row.date : ""}</td>
                  <td class="entry-type-${row.type && row.type.toLowerCase ? row.type.toLowerCase() : ""}">
                    ${row.type || ""}
                  </td>
                  <td>${row.details || row.note || row.description || ""}</td>
                  <td>${row.shares !== undefined ? row.shares : ""}</td>
                  <td>${row.price !== undefined ? row.price : ""}</td>
                  <td>${row.amount !== undefined ? row.amount : ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="footer">
            Report Generated: ${formattedNow}
          </div>
        </div>
      </body>
    </html>
  `;

  // Android native file save with .html as "PDF"
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
          duration: "long"
        });
      }
      return true;
    } catch (error) {
      console.error('Android file write error:', error);
      return openHtmlInBrowser(htmlContent, fileName);
    }
  } else {
    // For web browsers, download as .html file instead of opening
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
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
