import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: 'var(--shadow)' },
            success: { iconTheme: { primary: '#3E9B73', secondary: '#0b3d2e' } },
            error: { iconTheme: { primary: '#C8553D', secondary: '#fff' } },
          }}
        />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
