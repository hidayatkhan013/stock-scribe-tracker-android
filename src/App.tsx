
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import NewTransaction from "./pages/NewTransaction";
import Reports from "./pages/Reports";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { initializeDatabase } from "@/lib/db";

const queryClient = new QueryClient();

const App = () => {
  // Initialize database
  useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/transactions/new" element={<NewTransaction />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/export" element={<Export />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
