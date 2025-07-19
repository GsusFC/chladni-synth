# Context7 - Ejemplos de Uso para Chladni Synth

Este documento contiene ejemplos específicos de cómo usar Context7 en el desarrollo del Sintetizador Visual Chladni.

## Ejemplos de Prompts con Context7

### Desarrollo de Componentes React

```
Crea un componente React para controlar los parámetros de ecuación de Chladni (n, m) con sliders interactivos. use context7
```

```
Implementa un componente de visualización de espectrograma usando Canvas 2D que se actualice en tiempo real. use context7
```

### Optimización de Audio

```
Optimiza el análisis de frecuencias de Web Audio API para reducir la latencia en la visualización. use context7
```

```
Implementa detección de beats en tiempo real usando AnalyserNode y algoritmos de detección de picos. use context7
```

### Renderizado y Performance

```
Migra el renderizado de Canvas 2D a WebGL para mejorar el rendimiento con miles de partículas. use context7
```

```
Implementa OffscreenCanvas con Web Workers para renderizado en background thread. use context7
```

### Integración de Librerías

```
Integra Three.js para renderizado 3D de patrones de Chladni con efectos de iluminación. use context7
```

```
Añade soporte para MIDI controllers usando Web MIDI API para controlar parámetros en tiempo real. use context7
```

### Testing y Debugging

```
Crea tests unitarios para las funciones matemáticas de generación de patrones Chladni. use context7
```

```
Implementa herramientas de debugging para visualizar el flujo de datos de audio en tiempo real. use context7
```

## Configuración Específica del Proyecto

El archivo `context7.json` en la raíz del proyecto está configurado para:

- **Incluir**: Código fuente (`src/`), documentación (`docs/`) y archivos públicos (`public/`)
- **Excluir**: `node_modules`, archivos de build, configuraciones de herramientas
- **Reglas**: Mejores prácticas específicas para React, TypeScript, Web Audio API y WebGL

## Scripts NPM para Context7

- `npm run context7` - Ejecuta el servidor Context7 MCP
- `npm run context7:test` - Prueba Context7 con el inspector MCP
- `npm run context7:docs` - Muestra información sobre Context7

## Librerías Relevantes en Context7

Algunas librerías que puedes consultar específicamente:

- `/context7/react` - Documentación de React
- `/context7/typescript` - Guías de TypeScript
- `/context7/vite` - Configuración de Vite
- `/context7/webgl` - APIs de WebGL
- `/context7/canvas` - Canvas 2D API

## Tips para Mejores Resultados

1. **Sé específico**: Menciona las tecnologías exactas que estás usando
2. **Incluye contexto**: Explica qué parte del sintetizador estás desarrollando
3. **Usa "use context7"**: Siempre añade esto al final de tus prompts
4. **Combina tecnologías**: Menciona múltiples tecnologías cuando sea relevante

Ejemplo completo:
```
Crea un sistema de presets para el sintetizador que permita guardar y cargar configuraciones de parámetros Chladni, usando React hooks para el estado y localStorage para persistencia. Incluye validación TypeScript y animaciones suaves entre presets. use context7
```
