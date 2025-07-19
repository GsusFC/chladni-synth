# 🔬 Fundamentos Físicos y Matemáticos de los Patrones de Chladni

## 1. Introducción histórica  
En 1787 **Ernst Florens Friedrich Chladni** mostró públicamente que una placa metálica cubierta de arena fina dibuja figuras geométricas cuando se hace vibrar con un arco de violín.  
Las partículas se desplazan hasta las **líneas nodales** —regiones donde la amplitud de oscilación es prácticamente nula— revelando la geometría de los **modos propios** de la placa.

<div align="center"><small>«Las figuras acústicas de Chladni son la visualización directa de las soluciones de la ecuación de ondas en 2 D»</small></div>

---

## 2. Ondas estacionarias en una placa

### 2.1 La ecuación de ondas bidimensional  
Para una placa elástica delgada y homogénea (Kirchhoff–Love) la variable de interés es el desplazamiento transversal  
\( w(x,y,t) \).  
Una versión simplificada (despreciando curvatura y tensiones internas) usa la **ecuación de ondas 2 D**:

\[
\frac{\partial^2 w}{\partial t^2} = c^2 \left(
      \frac{\partial^2 w}{\partial x^2} + \frac{\partial^2 w}{\partial y^2}
\right) ,
\]

donde \( c = \sqrt{\dfrac{T}{\rho}} \) es la velocidad de propagación ( *T* tensión superficial, *ρ* densidad ).

### 2.2 Separación de variables  
Buscamos **modos estacionarios** de la forma  

\[
w(x,y,t)=\psi(x,y)\,\cos(2\pi f_{nm}\,t),
\]

que insertados en la ecuación generan el **problema propio** de Helmholtz

\[
\nabla^2\psi + k_{nm}^2\psi = 0,
\qquad k_{nm} = \frac{2\pi f_{nm}}{c}.
\]

### 2.3 Condiciones de contorno  
Para una placa **rectangular** sujeta rígidamente en el borde (\( w=0 \) y \(\partial w/\partial n =0\)) se obtienen soluciones senoidales:

\[
\boxed{\;
\psi_{nm}(x,y)=
\cos\!\Bigl(\frac{n\pi x}{L_x}\Bigr)\;
\cos\!\Bigl(\frac{m\pi y}{L_y}\Bigr)
-\cos\!\Bigl(\frac{m\pi x}{L_x}\Bigr)\;
\cos\!\Bigl(\frac{n\pi y}{L_y}\Bigr)
\;}
\]

con \( n,m \in \mathbb{N}^+ \).  
Las **líneas nodales** se localizan donde \( \psi_{nm}(x,y)=0 \).

### 2.4 Frecuencias propias  
El número de onda se relaciona con los índices de modo:

\[
k_{nm}^2 = \Bigl(\frac{n\pi}{L_x}\Bigr)^2 + \Bigl(\frac{m\pi}{L_y}\Bigr)^2
\quad\Longrightarrow\quad
f_{nm} = \frac{c}{2}\sqrt{ \Bigl(\frac{n}{L_x}\Bigr)^2+\Bigl(\frac{m}{L_y}\Bigr)^2 }.
\]

Mayor \( n \) o \( m \) implica frecuencia más alta y patrón más complejo.

---

## 3. Interpretación acústica

1. **Nodos:** puntos (o líneas) con desplazamiento cero; la arena se acumula aquí.  
2. **Antinodos:** crestas de máxima amplitud; la arena se expulsa.  
3. La energía acústica inyectada (frotar con un arco, excitación por altavoz…) excita varios modos; afinando la frecuencia se **resuena** uno concreto → la figura se hace nítida.  
4. Intercambio de energía entre modos genera *batidos* y transiciones de figura.

---

## 4. Generalizaciones

| Geometría | Coordenadas | Función propia (ejemplo) |
|-----------|-------------|--------------------------|
| **Circular** | polares (r, θ) | \( J_n(\alpha_{nm} r) \cos(nθ) \) |
| **Triangular** | baricéntricas | Series de senos combinados |
| **Membranas tensas** (tambores) | incluye tensión → mismos principios; las figuras se conocen como **modos de Chladni** del tambor |

*( \( J_n \) es la función de Bessel; \( \alpha_{nm} \) ceros de \( J_n \)).*

---

## 5. Factores reales

* **Amortiguamiento**: viscosidad del aire, rozamiento con soportes, dispersa la energía → figuras borrosas.  
* **No-idealidad**: placas no perfectamente uniformes → frecuencia desviada.  
* **Modo mixto**: excitaciones “fuera de tono” superponen varios \( (n,m) \).  
* **No linealidad** en grandes amplitudes distorsiona los nodos.

---

## 6. Del laboratorio al píxel

El sintetizador digital reproduce la ecuación estacionaria evaluando \( \psi_{nm}(x,y) \) en una malla de partículas.  
Cambiar `n` y `m`:

* incrementa la **densidad nodal**  
* altera la **simetría** (diagonal, axial…)  
* modifica la **frecuencia asociada** si se enlaza con audio

Con **ecuaciones personalizadas** se puede explorar interferencias no convencionales (por ejemplo, modos circulares o mezclas de Bessel y senos).

---

## 7. Conclusión

Los patrones de Chladni ilustran cómo las **condiciones de contorno** y la **frecuencia** determinan las formas posibles de una vibración estacionaria.  
En acústica los mismos principios gobiernan cuerdas, tuberías, membranas y salas de conciertos: la distribución espacial de nodos explica por qué ciertos tonos **resuenan** y otros se **cancelan**.  
Comprender estas ecuaciones nos permite **diseñar** instrumentos, optimizar auditorios y, como en este proyecto, crear experiencias visuales ligadas al sonido.
