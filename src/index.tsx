import React from 'react';
import ReactDOM from 'react-dom/client';
import ExampleIndustrial from './Example-industrial';

// Estilos globales para asegurar que la aplicación ocupe toda la pantalla
import './styles-industrial.css';

// Montar la aplicación en el elemento con id "root"
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('No se encontró el elemento con id "root" en el DOM');
}

// Usar la API moderna de React 18 para crear la raíz
const root = ReactDOM.createRoot(rootElement);

// Renderizar el componente Example
root.render(
  <React.StrictMode>
    <ExampleIndustrial />
  </React.StrictMode>
);
