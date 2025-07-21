import React, { useState, useRef, useEffect, useCallback } from 'react';

interface IndustrialHorizontalFaderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  width?: number;
  className?: string;
  precision?: number;
  defaultValue?: number;
  size?: 'sm' | 'md' | 'lg';
}

const IndustrialHorizontalFader: React.FC<IndustrialHorizontalFaderProps> = ({
  min,
  max,
  value,
  onChange,
  label = '',
  unit = '',
  formatValue,
  width = 200,
  className = '',
  precision = 2,
  defaultValue,
  size = 'md'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Size configurations
  const sizeConfig = {
    sm: { height: 6, thumbSize: 16, fontSize: 'var(--font-size-xs)' },
    md: { height: 8, thumbSize: 20, fontSize: 'var(--font-size-sm)' },
    lg: { height: 10, thumbSize: 24, fontSize: 'var(--font-size-md)' }
  };

  const config = sizeConfig[size];

  // Format the displayed value
  const displayValue = formatValue 
    ? formatValue(value) 
    : unit 
      ? `${value}${unit}`
      : `${value}`;

  // Calculate the thumb position based on current value
  const getThumbPosition = useCallback(() => {
    const percentage = ((value - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, percentage));
  }, [value, min, max]);

  // Calculate value from mouse/touch position
  const getValueFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    
    const rect = trackRef.current.getBoundingClientRect();
    const trackWidth = rect.width;
    const offsetX = clientX - rect.left;
    
    let percentage = offsetX / trackWidth;
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
      handleDoubleClick();
      return;
    }
    setLastClickTime(currentTime);
    
    const newValue = getValueFromPosition(e.clientX);
    onChange(newValue);
    setIsDragging(true);
  }, [getValueFromPosition, onChange, lastClickTime, handleDoubleClick]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newValue = getValueFromPosition(e.clientX);
    onChange(newValue);
  }, [isDragging, getValueFromPosition, onChange]);

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = (max - min) / 20;
    let newValue = value;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(max, value + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(min, value - step);
        break;
      case 'Home':
        e.preventDefault();
        newValue = min;
        break;
      case 'End':
        e.preventDefault();
        newValue = max;
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
    const step = (max - min) / 50;
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

  return (
    <div className={`industrial-horizontal-fader-container-enhanced ${className}`} style={{ width: `${width}px` }}>
      <div className="industrial-horizontal-fader-header">
        {label && <div className="industrial-horizontal-fader-label" style={{ fontSize: config.fontSize }}>{label}</div>}
        <div className="industrial-horizontal-fader-value" style={{ fontSize: config.fontSize }}>{displayValue}</div>
      </div>
      
      <div 
        ref={trackRef}
        className={`industrial-horizontal-fader-track-enhanced ${isDragging ? 'dragging' : ''} ${isHovered ? 'hovered' : ''}`}
        style={{ height: `${config.height}px` }}
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
        {/* Value fill bar */}
        <div 
          className="industrial-horizontal-fader-fill-enhanced"
          style={{ width: `${getThumbPosition()}%` }}
        />
        
        <div 
          className={`industrial-horizontal-fader-thumb-enhanced ${isDragging ? 'dragging' : ''}`}
          style={{ 
            left: `${getThumbPosition()}%`,
            width: `${config.thumbSize}px`,
            height: `${config.thumbSize}px`
          }}
        />
        
        {/* Hover indicator */}
        {isHovered && !isDragging && (
          <div 
            className="industrial-horizontal-fader-hover-indicator"
            style={{ 
              left: `${getThumbPosition()}%`,
              width: `${config.thumbSize + 8}px`,
              height: `${config.thumbSize + 8}px`
            }}
          />
        )}
      </div>
    </div>
  );
};

export default IndustrialHorizontalFader;
