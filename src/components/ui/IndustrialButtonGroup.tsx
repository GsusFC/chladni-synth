import React from 'react';

interface ButtonOption {
  value: string;
  label: string;
  icon?: string;
}

interface IndustrialButtonGroupProps {
  options: ButtonOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const IndustrialButtonGroup: React.FC<IndustrialButtonGroupProps> = ({
  options,
  value,
  onChange,
  className = '',
  size = 'md'
}) => {
  const sizeClass = {
    sm: 'industrial-button-group-sm',
    md: 'industrial-button-group-md', 
    lg: 'industrial-button-group-lg'
  }[size];

  return (
    <div className={`industrial-button-group ${sizeClass} ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          className={`industrial-button ${value === option.value ? 'industrial-button-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <span className="industrial-button-icon">{option.icon}</span>}
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default IndustrialButtonGroup;
