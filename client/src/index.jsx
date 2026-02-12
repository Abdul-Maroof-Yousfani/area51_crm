import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext';

import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <GoogleCalendarProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </GoogleCalendarProvider>
    </LanguageProvider>
  </React.StrictMode>
);
