
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, db, loginUser, registerUser } from '@/lib/db';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string, email?: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage for saved user session
    const savedUser = localStorage.getItem('stockscribe_user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setCurrentUser(parsedUser);
      } catch (e) {
        localStorage.removeItem('stockscribe_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const user = await loginUser(username, password);
      if (!user) {
        throw new Error('Invalid username or password');
      }
      setCurrentUser(user);
      // Save to local storage
      localStorage.setItem('stockscribe_user', JSON.stringify(user));
      return user;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string, 
    password: string, 
    email?: string
  ): Promise<User> => {
    setIsLoading(true);
    try {
      const user = await registerUser(username, password, email);
      setCurrentUser(user);
      // Save to local storage
      localStorage.setItem('stockscribe_user', JSON.stringify(user));
      return user;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('stockscribe_user');
  };

  const value = {
    currentUser,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
