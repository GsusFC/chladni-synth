import React, { useState, useRef, useEffect, useCallback } from 'react';

interface IndustrialVerticalFaderProps {
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
  precision?: number;
  defaultValue?: number; // Para doble clic reset
}

const IndustrialVerticalFader: React.FC<IndustrialVerticalFaderProps> = ({
  min,
  max,
  value,
  onChange,
  label = '',
  unit = '',
  formatValue,
  height = 100,
  tickCount = 5,
  className = '',
  precision = 2,
  defaultValue
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
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
    return (1 - percentage) * 100; // Invert for vertical slider
  }, [value, min, max]);

  // Calculate value from mouse/touch position
  const getValueFromPosition = useCallback((clientY: number) => {
    if (!trackRef.current) return value;
    
    const rect = trackRef.current.getBoundingClientRect();
    const trackHeight = rect.height;
    const offsetY = clientY - rect.top;
    
    let percentage = 1 - (offsetY / trackHeight);
    percentage = Math.max(0, Math.min(1, percentage));
    
    const newValue = min + percentage * (max - min);

    if (Number.isInteger(min) && Number.isInteger(max)) {
      return Math.round(newValue);
    }

    const multiplier = Math.pow(10, precision);
    return Math.round(newValue * multiplier) / multiplier;
  }, [min, max, value, precision]);

  // Handle double click to reset
  const handleDoubleClick = useCallback(() => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  }, [defaultValue, onChange]);

  // Handle mouse down on track
  const handleTrackMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    const currentTime = Date.now();
    if (currentTime - lastClickTime < 300) {
      // Double click detected
      handleDoubleClick();
      return;
    }
    setLastClickTime(currentTime);
    
    const newValue = getValueFromPosition(e.clientY);
    onChange(newValue);
    setIsDragging(true);
  }, [getValueFromPosition, onChange, lastClickTime, handleDoubleClick]);

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

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = (max - min) / 20; // 5% steps
    let newValue = value;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(max, value + step);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(min, value - step);
        break;
      case 'Home':
        e.preventDefault();
        newValue = max;
        break;
      case 'End':
        e.preventDefault();
        newValue = min;
        break;
      default:
        return;
    }

    if (Number.isInteger(min) && Number.isInteger(max)) {
      newValue = Math.round(newValue);
    } else {
      const multiplier = Math.pow(10, precision);
      newValue = Math.round(newValue * multiplier) / multiplier;
    }

    onChange(newValue);
  }, [value, min, max, precision, onChange]);

  // Handle scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = (max - min) / 50; // Smaller steps for wheel
    const delta = e.deltaY > 0 ? -step : step;
    let newValue = value + delta;
    
    newValue = Math.max(min, Math.min(max, newValue));
    
    if (Number.isInteger(min) && Number.isInteger(max)) {
      newValue = Math.round(newValue);
    } else {
      const multiplier = Math.pow(10, precision);
      newValue = Math.round(newValue * multiplier) / multiplier;
    }

    onChange(newValue);
  }, [value, min, max, precision, onChange]);

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
          className="industrial-fader-tick-enhanced"
          style={{ top: `${percentage}%` }}
        />
      );
    }
    return ticks;
  };

  return (
    <div className={`industrial-fader-container-enhanced ${className}`}>
      {label && <div className="industrial-fader-label-enhanced">{label}</div>}
      <div className="industrial-fader-value-enhanced">{displayValue}</div>
      
      <div 
        ref={trackRef}
        className={`industrial-fader-track-enhanced ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''}`}
        style={{ height: `${height}px` }}
        onMouseDown={handleTrackMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        tabIndex={0}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
      >
        {renderTicks()}
        
        {/* Value fill bar */}
        <div 
          className="industrial-fader-fill-enhanced"
          style={{ height: `${100 - getThumbPosition()}%` }}
        />
        
        <div 
          ref={thumbRef}
          className={`industrial-fader-thumb-enhanced ${isDragging ? 'dragging' : ''}`}
          style={{ top: `${getThumbPosition()}%` }}
        />
        
        {/* Hover indicator */}
        {isHovered && !isDragging && (
          <div 
            className="industrial-fader-hover-indicator"
            style={{ top: `${getThumbPosition()}%` }}
          />
        )}
      </div>
    </div>
  );
};

export default IndustrialVerticalFader;
