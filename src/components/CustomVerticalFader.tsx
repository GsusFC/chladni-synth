import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CustomVerticalFaderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  height?: number;
  tickCount?: number;
  className?: string;
}

const CustomVerticalFader: React.FC<CustomVerticalFaderProps> = ({
  min,
  max,
  value,
  onChange,
  label = '',
  unit = '',
  formatValue,
  height = 120,
  tickCount = 5,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  // Format the displayed value
  const displayValue = formatValue 
    ? formatValue(value) 
    : unit 
      ? `${value}${unit}`
      : `${value}`;

  // Calculate the thumb position based on current value
  const getThumbPosition = useCallback(() => {
    const percentage = ((value - min) / (max - min));
    // Invert for vertical slider (0 at bottom, max at top)
    return (1 - percentage) * 100;
  }, [value, min, max]);

  // Calculate value from mouse/touch position
  const getValueFromPosition = useCallback((clientY: number) => {
    if (!trackRef.current) return value;
    
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    const offsetY = clientY - rect.top;
    
    // Calculate percentage (inverted for vertical slider)
    let percentage = 1 - (offsetY / trackHeight);
    
    // Clamp percentage between 0 and 1
    percentage = Math.max(0, Math.min(1, percentage));
    
    // Convert percentage to value
    const newValue = min + percentage * (max - min);
    
    // Round to integer if min and max are integers
    if (Number.isInteger(min) && Number.isInteger(max)) {
      return Math.round(newValue);
    }
    
    // Otherwise round to 2 decimal places
    return Math.round(newValue * 100) / 100;
  }, [min, max, value]);

  // Handle mouse down on track
  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const newValue = getValueFromPosition(e.clientY);
    onChange(newValue);
    
    setIsDragging(true);
  }, [getValueFromPosition, onChange]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const newValue = getValueFromPosition(e.clientY);
    onChange(newValue);
  }, [isDragging, getValueFromPosition, onChange]);

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add and remove event listeners for drag
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Generate tick marks
  const renderTicks = () => {
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      const percentage = i / (tickCount - 1) * 100;
      ticks.push(
        <div 
          key={i}
          className="industrial-fader-tick"
          style={{ top: `${percentage}%` }}
        />
      );
    }
    return ticks;
  };

  return (
    <div className={`industrial-fader-container ${className}`}>
      {label && <div className="industrial-fader-label">{label}</div>}
      <div className="industrial-fader-value">{displayValue}</div>
      
      <div 
        ref={trackRef}
        className="industrial-fader-track"
        style={{ height: `${height}px` }}
        onMouseDown={handleTrackMouseDown}
      >
        {renderTicks()}
        
        <div 
          ref={thumbRef}
          className="industrial-fader-thumb"
          style={{ top: `${getThumbPosition()}%` }}
        />
      </div>
    </div>
  );
};

export default CustomVerticalFader;
