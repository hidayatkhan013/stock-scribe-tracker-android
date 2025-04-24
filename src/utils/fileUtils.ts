// Platform detection utils
export const isAndroid = (): boolean => {
  return (typeof (window as any).Capacitor !== 'undefined' && 
    (window as any).Capacitor.getPlatform() === 'android') || 
    (window.navigator && 
    window.navigator.userAgent && 
    window.navigator.userAgent.includes('Android'));
};

export const isCapacitorNative = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined' && 
    (window as any).Capacitor.isNativePlatform();
};

interface SaveResult {
  success: boolean;
  message: string;
  filePath?: string;
}

/**
 * Downloads data as a CSV file using the browser's download capabilities
 */
export const downloadCSV = async (data: any[], fileName: string): Promise<SaveResult> => {
  try {
    if (!data.length) {
      return {
        success: false,
        message: 'No data to export'
      };
    }

    // Ensure all objects have the same keys
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: `File ${fileName}.csv downloaded successfully`,
      filePath: fileName + '.csv'
    };
  } catch (error) {
    console.error('CSV generation error:', error);
    return {
      success: false,
      message: `Error generating CSV: ${error.message || String(error)}`
    };
  }
};

/**
 * Downloads data as an HTML file that looks like a PDF
 */
export const downloadPDF = async (
  data: any[],
  fileName: string,
  username?: string
): Promise<SaveResult> => {
  try {
    if (!data.length) {
      return {
        success: false,
        message: 'No data to export'
      };
    }

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

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: `File ${fileName}.html downloaded successfully`,
      filePath: fileName + '.html'
    };
  } catch (error) {
    console.error('HTML/PDF generation error:', error);
    return {
      success: false,
      message: `Error generating HTML: ${error.message || String(error)}`
    };
  }
};

// Simplified test function that just checks if we're on Android
export const testCapacitorPermissions = async (): Promise<{success: boolean; message: string}> => {
  if (!isAndroid() || !isCapacitorNative()) {
    return { 
      success: false, 
      message: 'Not running on Android native platform' 
    };
  }
  return {
    success: true,
    message: 'Running on Android - downloads will use browser functionality'
  };
};
