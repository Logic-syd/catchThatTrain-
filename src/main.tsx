import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './game.css';
import './preparation.css';
import {initializeLanguage} from './i18n';
initializeLanguage();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
