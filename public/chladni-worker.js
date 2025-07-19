// Chladni Synthesizer Web Worker
// Handles particle calculations and WebGL rendering in background thread

let canvas = null;
let gl = null;
let program = null;
let bufferInfo = { position: null, color: null, count: 0 };
let particles = [];
let chladniParams = { n: 5, m: 3 };
let particleSize = 2;
let particleOpacity = 0.8;
let colorMode = 'spectrum';
let isRunning = false;

// Mathematical constants and functions
const PI = Math.PI;
const cos = Math.cos;

// Chladni equation
const chladni = (x, y, n, m) => {
  const L = 2; // Coordinate space [-1, 1]
  return cos(n * PI * x / L) * cos(m * PI * y / L) - cos(m * PI * x / L) * cos(n * PI * y / L);
};

// Constrain function
const constrain = (val, min, max) => {
  return Math.max(min, Math.min(max, val));
};

// Color conversion for WebGL
const getColorFromFrequency = (value, max) => {
  const normalizedValue = Math.min(value / max, 1);
  const a = particleOpacity;
  
  let r = 1, g = 1, b = 1;
  
  switch (colorMode) {
    case 'spectrum':
      // Convert HSL to RGB
      const hue = normalizedValue * 360;
      const c = 1; // Chroma (saturation = 100%)
      const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
      const m = 0.5 - c / 2; // Lightness = 50%
      
      if (hue < 60) { r = c; g = x; b = 0; }
      else if (hue < 120) { r = x; g = c; b = 0; }
      else if (hue < 180) { r = 0; g = c; b = x; }
      else if (hue < 240) { r = 0; g = x; b = c; }
      else if (hue < 300) { r = x; g = 0; b = c; }
      else { r = c; g = 0; b = x; }
      
      r += m; g += m; b += m;
      break;
      
    case 'amplitude':
      const brightness = 0.4 + normalizedValue * 0.6;
      r = 0.2; g = 1; b = brightness;
      break;
      
    case 'frequency':
      if (value < (max / 3)) {
        r = 1; g = 0.2; b = 0.2;
      } else if (value < (max * 2 / 3)) {
        r = 0.2; g = 1; b = 0.2;
      } else {
        r = 0.2; g = 0.2; b = 1;
      }
      break;
      
    default:
      r = 1; g = 1; b = 1;
  }
  
  return [r, g, b, a];
};

// WebGL helpers
const createShader = (gl, type, source) => {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    console.error("Could not compile shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
};

const createProgram = (gl, vertexShader, fragmentShader) => {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error("Could not link program:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
};

// Initialize WebGL
const initWebGL = (canvas) => {
  try {
    const glContext = canvas.getContext('webgl2') || 
                     canvas.getContext('webgl') || 
                     canvas.getContext('experimental-webgl');
    
    if (!glContext) {
      postMessage({ type: 'error', data: 'WebGL not supported' });
      return null;
    }
    
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      
      uniform mat3 u_matrix;
      uniform float u_pointSize;
      
      varying vec4 v_color;
      
      void main() {
        vec3 position = u_matrix * vec3(a_position, 1.0);
        gl_Position = vec4(position.xy, 0.0, 1.0);
        gl_PointSize = u_pointSize;
        v_color = a_color;
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      
      varying vec4 v_color;
      
      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5, 0.5);
        if(length(coord) > 0.5) {
          discard;
        }
        
        gl_FragColor = v_color;
      }
    `;
    
    const vertexShader = createShader(glContext, glContext.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(glContext, glContext.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
      return null;
    }
    
    const shaderProgram = createProgram(glContext, vertexShader, fragmentShader);
    
    if (!shaderProgram) {
      return null;
    }
    
    // Create buffers
    const positionBuffer = glContext.createBuffer();
    const colorBuffer = glContext.createBuffer();
    
    bufferInfo = {
      position: positionBuffer,
      color: colorBuffer,
      count: 0
    };
    
    // Enable blending
    glContext.enable(glContext.BLEND);
    glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);
    
    return { gl: glContext, program: shaderProgram };
  } catch (error) {
    postMessage({ type: 'error', data: 'Error initializing WebGL: ' + error.message });
    return null;
  }
};

// Update and render particles
const updateParticles = (audioInfluence = 0, frequencyData = null) => {
  if (!gl || !program || particles.length === 0) return;
  
  const { n, m } = chladniParams;
  
  // Update particle positions
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    
    const speed = 0.035 * (1 + audioInfluence);
    const vibrationMax = 0.003 * (1 + audioInfluence * 2);
    const vibrationX = Math.random() * 2 * vibrationMax - vibrationMax;
    const vibrationY = Math.random() * 2 * vibrationMax - vibrationMax;
    const randomNum = Math.random() * 0.7 - 0.2;
    
    const amount = chladni(p.x, p.y, n, m);
    
    // Stochastic gradient descent with audio influence
    if (amount >= 0) {
      if (chladni(p.x + vibrationMax, p.y, n, m) >= amount) {
        p.x -= randomNum * amount * speed + vibrationX;
      } else {
        p.x += randomNum * amount * speed + vibrationX;
      }
      if (chladni(p.x, p.y + vibrationMax, n, m) >= amount) {
        p.y -= randomNum * amount * speed + vibrationY;
      } else {
        p.y += randomNum * amount * speed + vibrationY;
      }
    } else { // amount < 0
      if (chladni(p.x + vibrationMax, p.y, n, m) <= amount) {
        p.x += randomNum * amount * speed + vibrationX;
      } else {
        p.x -= randomNum * amount * speed + vibrationX;
      }
      if (chladni(p.x, p.y + vibrationMax, n, m) <= amount) {
        p.y += randomNum * amount * speed + vibrationY;
      } else {
        p.y -= randomNum * amount * speed + vibrationY;
      }
    }
    
    p.x = constrain(p.x, -1, 1);
    p.y = constrain(p.y, -1, 1);
    
    // Color based on audio frequency data
    if (frequencyData && frequencyData.length > 0) {
      const binIndex = Math.floor(Math.abs(p.x + p.y + 2) / 4 * (frequencyData.length - 1));
      const value = frequencyData[binIndex];
      p.color = getColorFromFrequency(value, 255);
    } else {
      p.color = [1, 1, 1, particleOpacity];
    }
  }
  
  // Prepare WebGL data
  const positions = new Float32Array(particles.length * 2);
  const colors = new Float32Array(particles.length * 4);
  
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    
    positions[i * 2] = p.x;
    positions[i * 2 + 1] = p.y;
    
    colors[i * 4] = p.color[0];
    colors[i * 4 + 1] = p.color[1];
    colors[i * 4 + 2] = p.color[2];
    colors[i * 4 + 3] = p.color[3];
  }
  
  // Clear canvas
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Update WebGL buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.position);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.color);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
  
  bufferInfo.count = particles.length;
  
  // Draw particles
  gl.useProgram(program);
  
  // Set up position attribute
  const positionLocation = gl.getAttribLocation(program, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.position);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  
  // Set up color attribute
  const colorLocation = gl.getAttribLocation(program, "a_color");
  gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.color);
  gl.enableVertexAttribArray(colorLocation);
  gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 0, 0);
  
  // Set up uniforms
  const matrixLocation = gl.getUniformLocation(program, "u_matrix");
  const pointSizeLocation = gl.getUniformLocation(program, "u_pointSize");
  
  // Create transformation matrix (identity for now)
  const matrix = [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];
  
  gl.uniformMatrix3fv(matrixLocation, false, matrix);
  gl.uniform1f(pointSizeLocation, particleSize);
  
  // Draw
  gl.drawArrays(gl.POINTS, 0, bufferInfo.count);
};

// Animation loop
const animate = () => {
  if (!isRunning) return;
  
  // Request next frame first for better performance
  requestAnimationFrame(animate);
  
  // Send message to main thread to get audio data
  postMessage({ type: 'requestAudioData' });
};

// Message handler
self.onmessage = (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'init':
      canvas = data.canvas;
      particleSize = data.particleSize;
      particleOpacity = data.particleOpacity;
      colorMode = data.colorMode;
      
      const webglContext = initWebGL(canvas);
      if (webglContext) {
        gl = webglContext.gl;
        program = webglContext.program;
        postMessage({ type: 'initialized' });
      }
      break;
      
    case 'setParticles':
      particles = data;
      break;
      
    case 'updateParams':
      chladniParams = data;
      break;
      
    case 'updateSettings':
      if (data.particleSize !== undefined) particleSize = data.particleSize;
      if (data.particleOpacity !== undefined) particleOpacity = data.particleOpacity;
      if (data.colorMode !== undefined) colorMode = data.colorMode;
      break;
      
    case 'audioData':
      updateParticles(data.audioInfluence, data.frequencyData);
      break;

    case 'update':
      // Actualizar sin datos de audio (para testing)
      const simulatedInfluence = 0.1 + Math.sin(Date.now() * 0.001) * 0.05;
      updateParticles(simulatedInfluence, null);
      break;
      
    case 'resize':
      if (gl && data.width && data.height) {
        gl.viewport(0, 0, data.width, data.height);
      }
      break;
      
    case 'start':
      isRunning = true;
      animate();
      break;
      
    case 'stop':
      isRunning = false;
      break;
  }
};
