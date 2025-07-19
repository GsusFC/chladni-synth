import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CustomHorizontalFaderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  /* If omitted the fader stretches to the full available width */
  width?: number;
  tickCount?: number;
  className?: string;
  disabled?: boolean;
}

const CustomHorizontalFader: React.FC<CustomHorizontalFaderProps> = ({
  min,
  max,
  value,
  onChange,
  label = '',
  unit = '',
  formatValue,
  width = undefined,
  tickCount = 5,
  className = '',
  disabled = false
}) => {
  /* ------------------------------------------------------------------
   *  STATE & REFS
   * ------------------------------------------------------------------ */
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Format the displayed value
  const displayValue = formatValue 
    ? formatValue(value) 
    : unit 
      ? `${value}${unit}`
      : `${value}`;

  // Calculate the thumb position based on current value
  const getThumbPosition = useCallback(() => {
    const percentage = ((value - min) / (max - min));
    return percentage * 100;
  }, [value, min, max]);

  // Calculate value from mouse/touch position
  const getValueFromPosition = useCallback((clientX: number) => {
    if (!trackRef.current) return value;
    
    const rect = trackRef.current.getBoundingClientRect();
    const trackWidth = rect.width;
    const offsetX = clientX - rect.left;
    
    // Calculate percentage
    let percentage = offsetX / trackWidth;
    
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
    if (disabled) return;
    e.preventDefault();
    
    const newValue = getValueFromPosition(e.clientX);
    onChange(newValue);
    
    setIsDragging(true);
  }, [getValueFromPosition, onChange, disabled]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;
    
    const newValue = getValueFromPosition(e.clientX);
    onChange(newValue);
  }, [isDragging, getValueFromPosition, onChange, disabled]);

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
          style={{ left: `${percentage}%` }}
        />
      );
    }
    return ticks;
  };

  return (
    <div
      className={`industrial-horizontal-fader-container ${className} ${
        disabled ? 'industrial-fader-disabled' : ''
      }`}
      style={{ width: width !== undefined ? `${width}px` : '100%' }}
    >
      {/* Optional label on top */}
      {label && <div className="industrial-fader-label">{label}</div>}

      {/* Value display */}
      <div className="industrial-fader-value">{displayValue}</div>

      {/* Track + thumb */}
      <div
        ref={trackRef}
        className="industrial-fader-track-horizontal"
        onMouseDown={handleTrackMouseDown}
      >
        {renderTicks()}

        <div
          className="industrial-fader-thumb"
          style={{ left: `${getThumbPosition()}%` }}
        />

        {/* Filled bar */}
        <div
          className="industrial-fader-value-line-horizontal"
          style={{ width: `${getThumbPosition()}%` }}
        />
      </div>

      {/* Min / Max labels under track */}
      <div className="industrial-flex industrial-justify-between industrial-text-center">
        <span className="industrial-label">{formatValue ? formatValue(min) : min}</span>
        <span className="industrial-label">{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
};

export default CustomHorizontalFader;
