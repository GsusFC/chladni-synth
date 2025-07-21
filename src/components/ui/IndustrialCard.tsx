import React from 'react';

interface IndustrialCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

const IndustrialCard: React.FC<IndustrialCardProps> = ({
  title,
  icon,
  children,
  className = '',
  headerActions
}) => {
  return (
    <div className={`industrial-module ${className}`}>
      <div className="industrial-module-header">
        <div className="industrial-module-title-section">
          {icon && <span className="industrial-module-icon">{icon}</span>}
          <span className="industrial-module-title">{title}</span>
        </div>
        {headerActions && (
          <div className="industrial-module-actions">
            {headerActions}
          </div>
        )}
      </div>
      <div className="industrial-module-content industrial-content-area">
        {children}
      </div>
    </div>
  );
};

export default IndustrialCard;
