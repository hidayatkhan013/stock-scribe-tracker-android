
import Dexie, { Table } from 'dexie';

// Define interfaces for our database tables
export interface User {
  id?: number;
  username: string;
  password: string; // In a real app, this would be hashed
  email?: string;
  createdAt: Date;
}

export interface Stock {
  id?: number;
  ticker: string;
  name: string;
  currency: string;
  userId: number;
}

export interface Transaction {
  id?: number;
  stockId: number;
  userId: number;
  type: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  currency: string; // Added currency property
  date: Date;
  note?: string;
}

export interface Currency {
  id: number; 
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number; // Relative to base currency (USD)
  lastUpdated: Date;
}

// New interface for user settings
export interface Settings {
  id?: number;
  userId: number;
  defaultCurrency: string;
  darkMode?: boolean;
}

// Define our database
class StockScribeDB extends Dexie {
  users!: Table<User, number>;
  stocks!: Table<Stock, number>;
  transactions!: Table<Transaction, number>;
  currencies!: Table<Currency, string>;
  settings!: Table<Settings, number>; // Add settings table

  constructor() {
    super('StockScribeDB');
    
    // Define tables and indexes
    this.version(1).stores({
      users: '++id, username, email',
      stocks: '++id, ticker, userId, [userId+ticker]',
      transactions: '++id, stockId, userId, type, date, [userId+date], [stockId+date]',
      currencies: '++id, code, name'  // Updated to include id as auto-incrementing primary key
    });
    
    // Add settings table in version 2
    this.version(2).stores({
      settings: '++id, userId'
    });
  }
}

// Initialize the database
export const db = new StockScribeDB();

// Default currencies
export const defaultCurrencies: Currency[] = [
  { 
    id: 1,
    code: 'USD', 
    name: 'US Dollar', 
    symbol: '$', 
    exchangeRate: 1, 
    lastUpdated: new Date() 
  },
  { 
    id: 2,
    code: 'EUR', 
    name: 'Euro', 
    symbol: '€', 
    exchangeRate: 0.91, 
    lastUpdated: new Date() 
  },
  { 
    id: 3,
    code: 'GBP', 
    name: 'British Pound', 
    symbol: '£', 
    exchangeRate: 0.78, 
    lastUpdated: new Date() 
  },
  { 
    id: 4,
    code: 'JPY', 
    name: 'Japanese Yen', 
    symbol: '¥', 
    exchangeRate: 151.58, 
    lastUpdated: new Date() 
  }
];

// Initialize the database with default data
export async function initializeDatabase() {
  // Check if currencies already exist
  const currencyCount = await db.currencies.count();
  
  if (currencyCount === 0) {
    // Add default currencies
    await db.currencies.bulkAdd(defaultCurrencies);
  }
}

// Add getStock function that was missing
export async function getStock(ticker: string): Promise<Stock | undefined> {
  return await db.stocks.where('ticker').equals(ticker).first();
}

// Helper function to calculate profit/loss for a transaction
export function calculateProfitLoss(transaction: Transaction, 
                                    previousTransactions: Transaction[]): number {
  if (transaction.type === 'buy') {
    return 0; // No profit/loss for buy transactions
  }
  
  // For sell transactions, calculate profit/loss based on FIFO method
  let remainingShares = transaction.shares;
  let costBasis = 0;
  
  const buyTransactions = previousTransactions
    .filter(t => t.stockId === transaction.stockId && t.type === 'buy')
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  
  for (const buyTx of buyTransactions) {
    if (remainingShares <= 0) break;
    
    const sharesUsed = Math.min(buyTx.shares, remainingShares);
    costBasis += sharesUsed * buyTx.price;
    remainingShares -= sharesUsed;
  }
  
  const revenue = transaction.shares * transaction.price;
  return revenue - costBasis;
}

// User authentication helpers
export async function registerUser(username: string, password: string, email?: string): Promise<User> {
  // Check if user already exists
  const existingUser = await db.users.where({ username }).first();
  if (existingUser) {
    throw new Error('Username already exists');
  }
  
  // In a real app, password would be hashed here
  const newUser: User = {
    username,
    password,
    email,
    createdAt: new Date()
  };
  
  const id = await db.users.add(newUser);
  return { ...newUser, id };
}

export async function loginUser(username: string, password: string): Promise<User | null> {
  // In a real app, password comparison would use hashing
  const user = await db.users.where({ username, password }).first();
  return user || null;
}

// Stock helpers
export async function addStock(stock: Omit<Stock, 'id'>): Promise<number> {
  // Check if stock already exists for this user
  const existingStock = await db.stocks
    .where('[userId+ticker]')
    .equals([stock.userId, stock.ticker])
    .first();
  
  if (existingStock) {
    return existingStock.id as number;
  }
  
  return await db.stocks.add(stock);
}

// Transaction helpers
export async function addTransaction(transaction: Omit<Transaction, 'id'>): Promise<number> {
  return await db.transactions.add(transaction);
}

export async function getTransactionsForUser(userId: number): Promise<Transaction[]> {
  return await db.transactions
    .where('userId')
    .equals(userId)
    .toArray();
}

export async function getTransactionsForStock(stockId: number): Promise<Transaction[]> {
  return await db.transactions
    .where('stockId')
    .equals(stockId)
    .toArray();
}

// Reporting functions
export async function getPortfolioSummary(userId: number) {
  const transactions = await getTransactionsForUser(userId);
  const stocks = await db.stocks.where('userId').equals(userId).toArray();
  
  const stockMap = new Map(stocks.map(stock => [stock.id, stock]));
  const portfolioItems: Record<number, { 
    stock: Stock, 
    shares: number, 
    averageCost: number,
    totalCost: number,
    profitLoss: number 
  }> = {};
  
  // Calculate holdings and profit/loss for each stock
  for (const tx of transactions) {
    if (!tx.stockId || !stockMap.has(tx.stockId)) continue;
    
    const stock = stockMap.get(tx.stockId)!;
    
    if (!portfolioItems[tx.stockId]) {
      portfolioItems[tx.stockId] = {
        stock,
        shares: 0,
        averageCost: 0,
        totalCost: 0,
        profitLoss: 0
      };
    }
    
    const item = portfolioItems[tx.stockId];
    
    if (tx.type === 'buy') {
      const newShareCount = item.shares + tx.shares;
      const newCost = item.totalCost + (tx.price * tx.shares);
      item.totalCost = newCost;
      item.shares = newShareCount;
      item.averageCost = newCost / newShareCount;
    } else {
      // Sell transaction
      item.shares -= tx.shares;
      const saleValue = tx.price * tx.shares;
      const costBasis = item.averageCost * tx.shares;
      item.profitLoss += saleValue - costBasis;
      
      // Adjust total cost
      if (item.shares > 0) {
        item.totalCost = item.averageCost * item.shares;
      } else {
        item.totalCost = 0;
        item.averageCost = 0;
      }
    }
  }
  
  return Object.values(portfolioItems);
}

export async function getProfitLossReport(userId: number, 
                                         startDate: Date, 
                                         endDate: Date) {
  // Get all transactions for this user in the date range
  const transactions = await db.transactions
    .where('userId')
    .equals(userId)
    .and(tx => {
      const txDate = new Date(tx.date).getTime();
      return txDate >= startDate.getTime() && txDate <= endDate.getTime();
    })
    .toArray();
    
  // Get all the user's stocks
  const stocks = await db.stocks
    .where('userId')
    .equals(userId)
    .toArray();
    
  const stockMap = new Map(stocks.map(stock => [stock.id, stock]));
  
  // Calculate daily profit/loss
  const dailyProfitLoss: Record<string, {
    date: string,
    profit: number,
    loss: number,
    net: number
  }> = {};
  
  // Calculate stock-wise profit/loss
  const stockProfitLoss: Record<number, {
    stock: Stock,
    profit: number,
    loss: number,
    net: number
  }> = {};
  
  // Initialize the stockProfitLoss object
  stocks.forEach(stock => {
    if (stock.id) {
      stockProfitLoss[stock.id] = {
        stock,
        profit: 0,
        loss: 0,
        net: 0
      };
    }
  });
  
  // Process all transactions
  for (const tx of transactions) {
    if (tx.type !== 'sell') continue; // Only sell transactions realize profit/loss
    
    // Get all previous transactions for this stock
    const previousTxs = await db.transactions
      .where('stockId')
      .equals(tx.stockId)
      .and(t => t.date < tx.date)
      .toArray();
    
    const profitLoss = calculateProfitLoss(tx, previousTxs);
    const dateStr = tx.date.toISOString().split('T')[0];
    
    // Add to daily profit/loss
    if (!dailyProfitLoss[dateStr]) {
      dailyProfitLoss[dateStr] = {
        date: dateStr,
        profit: 0,
        loss: 0,
        net: 0
      };
    }
    
    if (profitLoss > 0) {
      dailyProfitLoss[dateStr].profit += profitLoss;
    } else {
      dailyProfitLoss[dateStr].loss += Math.abs(profitLoss);
    }
    dailyProfitLoss[dateStr].net += profitLoss;
    
    // Add to stock profit/loss
    if (tx.stockId && stockProfitLoss[tx.stockId]) {
      if (profitLoss > 0) {
        stockProfitLoss[tx.stockId].profit += profitLoss;
      } else {
        stockProfitLoss[tx.stockId].loss += Math.abs(profitLoss);
      }
      stockProfitLoss[tx.stockId].net += profitLoss;
    }
  }
  
  return {
    daily: Object.values(dailyProfitLoss).sort((a, b) => a.date.localeCompare(b.date)),
    stocks: Object.values(stockProfitLoss).sort((a, b) => b.net - a.net)
  };
}

// Get or create user settings
export async function getUserSettings(userId: number): Promise<Settings> {
  let settings = await db.settings.where('userId').equals(userId).first();
  
  if (!settings) {
    const id = await db.settings.add({
      userId,
      defaultCurrency: 'USD',
      darkMode: false
    });
    
    settings = {
      id,
      userId,
      defaultCurrency: 'USD',
      darkMode: false
    };
  }
  
  return settings;
}
