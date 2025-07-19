# 🎶✨ Sintetizador Visual Chladni

Un sintetizador visual moderno que genera patrones de Chladni en tiempo real, reaccionando al audio del micrófono o archivos de audio.

## Características

- **Visualización interactiva** de patrones Chladni
- **Reacción al audio** del micrófono o archivos de sonido
- **Modo básico** con Canvas 2D para todos los dispositivos
- **Modo optimizado** con WebGL, OffscreenCanvas y Web Workers para alto rendimiento

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repo> chladni-synth
cd chladni-synth

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev
```

## Uso

1. Abre el navegador en http://localhost:3000
2. Selecciona entre Modo Básico o Modo Optimizado
3. Haz clic en "Start Audio" para activar el micrófono
4. Observa cómo los patrones reaccionan al sonido
5. Experimenta con los controles para cambiar parámetros

## Estructura del proyecto

```
chladni-synth/
├── public/             # Archivos estáticos
├── src/
│   ├── components/     # Componentes React
│   │   ├── ChladniSynthesizer.tsx         # Versión básica con Canvas 2D
│   │   └── ChladniSynthesizerOptimized.tsx # Versión con WebGL
│   ├── Example.tsx     # Componente de ejemplo
│   ├── index.tsx       # Punto de entrada
│   └── styles.css      # Estilos globales
└── package.json        # Dependencias y scripts
```

## Tecnologías

- React + TypeScript
- Web Audio API
- Canvas 2D / WebGL
- OffscreenCanvas + Web Workers
- Context7 MCP para documentación actualizada

## Context7 Integration

Este proyecto está integrado con Context7 MCP (Model Context Protocol) para proporcionar documentación actualizada durante el desarrollo.

### ¿Qué es Context7?

Context7 es un servidor MCP que proporciona acceso a documentación actualizada de librerías y frameworks, permitiendo a los asistentes de IA obtener información precisa y actual sobre las tecnologías que usas.

### Configuración

El proyecto incluye un archivo `context7.json` que define:
- Título y descripción del proyecto
- Carpetas a incluir/excluir en la documentación
- Reglas de desarrollo específicas para el proyecto
- Configuración de versiones

### Scripts disponibles

```bash
# Ejecutar Context7 MCP server
npm run context7

# Probar Context7 con inspector
npm run context7:test

# Ver información sobre Context7
npm run context7:docs
```

### Uso con asistentes de IA

Para obtener documentación actualizada, añade `use context7` a tus prompts:

```
Crea un nuevo componente React para visualizar el espectrograma de audio. use context7
```

```
Optimiza el renderizado WebGL para mejor rendimiento. use context7
```

## Créditos

Basado en los patrones de Chladni descubiertos por Ernst Chladni (1756-1827).

## Licencia

MIT
