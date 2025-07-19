import React, { useState, useRef, useCallback } from 'react';

interface SimpleHorizontalFaderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

const SimpleHorizontalFader: React.FC<SimpleHorizontalFaderProps> = ({
  min,
  max,
  value,
  onChange
}) => {
  // Estado para controlar si estamos arrastrando
  const [isDragging, setIsDragging] = useState(false);
  
  // Referencia al track para calcular posiciones
  const trackRef = useRef<HTMLDivElement>(null);

  // Calcular posición del thumb (0-100%)
  const getThumbPosition = () => {
    return ((value - min) / (max - min)) * 100;
  };

  // Convertir posición del mouse a valor
  const getValueFromPosition = (clientX: number) => {
    if (!trackRef.current) return value;
    
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    
    return min + percentage * (max - min);
  };

  // Iniciar arrastre
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Actualizar valor basado en la posición del clic
    const newValue = getValueFromPosition(e.clientX);
    onChange(newValue);
    
    // Activar modo arrastre
    setIsDragging(true);
    
    // Agregar event listeners para el arrastre
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Manejar movimiento durante arrastre
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newValue = getValueFromPosition(e.clientX);
      onChange(newValue);
    }
  }, [isDragging, onChange]);

  // Terminar arrastre
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Estilos inline para mantenerlo simple
  const containerStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 0',
    userSelect: 'none',
  };
  
  const valueStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '8px',
    fontSize: '14px',
  };
  
  const trackStyle: React.CSSProperties = {
    position: 'relative',
    height: '8px',
    backgroundColor: '#222',
    borderRadius: '4px',
    cursor: 'pointer',
  };
  
  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    width: '16px',
    height: '16px',
    backgroundColor: '#FF6B35',
    borderRadius: '50%',
    top: '50%',
    left: `${getThumbPosition()}%`,
    transform: 'translate(-50%, -50%)',
    cursor: isDragging ? 'grabbing' : 'grab',
  };
  
  const filledStyle: React.CSSProperties = {
    position: 'absolute',
    height: '100%',
    width: `${getThumbPosition()}%`,
    backgroundColor: '#FF6B35',
    borderRadius: '4px 0 0 4px',
  };

  return (
    <div style={containerStyle}>
      {/* Valor actual */}
      <div style={valueStyle}>{value.toFixed(2)}</div>
      
      {/* Track con thumb */}
      <div 
        ref={trackRef}
        style={trackStyle}
        onMouseDown={handleMouseDown}
      >
        {/* Parte llena del track */}
        <div style={filledStyle} />
        
        {/* Thumb arrastrable */}
        <div style={thumbStyle} />
      </div>
      
      {/* Min/Max labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export default SimpleHorizontalFader;
