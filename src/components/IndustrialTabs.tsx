import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';

// Interfaz para definir la estructura de un tab individual
export interface TabItem {
  id: string;
  label: React.ReactNode;
  content: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

// Props para el componente IndustrialTabs
interface IndustrialTabsProps {
  tabs: TabItem[];
  defaultActiveTab?: string;
  onTabChange?: (tabId: string) => void;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
  ariaLabel?: string;
}

const IndustrialTabs: React.FC<IndustrialTabsProps> = ({
  tabs,
  defaultActiveTab,
  onTabChange,
  orientation = 'horizontal',
  size = 'medium',
  fullWidth = false,
  className = '',
  tabClassName = '',
  contentClassName = '',
  ariaLabel = 'Navegación por pestañas'
}) => {
  // Estado para el tab activo
  const [activeTabId, setActiveTabId] = useState<string>(
    defaultActiveTab || (tabs.length > 0 ? tabs[0].id : '')
  );
  
  // Referencia para la lista de tabs
  const tabsRef = useRef<HTMLDivElement>(null);
  
  // Referencias para cada tab individual
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  
  // Efecto para notificar cambios de tab
  useEffect(() => {
    if (onTabChange) {
      onTabChange(activeTabId);
    }
  }, [activeTabId, onTabChange]);
  
  // Manejador para cambiar de tab
  const handleTabChange = (tabId: string) => {
    if (tabs.find(tab => tab.id === tabId && !tab.disabled)) {
      setActiveTabId(tabId);
    }
  };
  
  // Navegación por teclado
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    const tabsArray = tabs.filter(tab => !tab.disabled);
    const currentIndex = tabsArray.findIndex(tab => tab.id === tabId);
    let nextIndex: number;
    
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        nextIndex = (currentIndex + 1) % tabsArray.length;
        handleTabChange(tabsArray[nextIndex].id);
        tabRefs.current.get(tabsArray[nextIndex].id)?.focus();
        break;
        
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        nextIndex = (currentIndex - 1 + tabsArray.length) % tabsArray.length;
        handleTabChange(tabsArray[nextIndex].id);
        tabRefs.current.get(tabsArray[nextIndex].id)?.focus();
        break;
        
      case 'Home':
        event.preventDefault();
        handleTabChange(tabsArray[0].id);
        tabRefs.current.get(tabsArray[0].id)?.focus();
        break;
        
      case 'End':
        event.preventDefault();
        handleTabChange(tabsArray[tabsArray.length - 1].id);
        tabRefs.current.get(tabsArray[tabsArray.length - 1].id)?.focus();
        break;
        
      default:
        break;
    }
  };
  
  // Clases para el tamaño de los tabs
  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'industrial-tabs-small';
      case 'large': return 'industrial-tabs-large';
      default: return '';
    }
  };
  
  // Renderizar el contenido activo
  const renderActiveContent = () => {
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    return activeTab ? (
      <div 
        className={`industrial-tab-content ${contentClassName}`}
        role="tabpanel"
        id={`tabpanel-${activeTabId}`}
        aria-labelledby={`tab-${activeTabId}`}
      >
        {activeTab.content}
      </div>
    ) : null;
  };
  
  return (
    <div className={`industrial-tabs-container ${orientation === 'vertical' ? 'industrial-tabs-vertical' : ''} ${className}`}>
      {/* Tab List */}
      <div 
        className={`industrial-tabs-list ${getSizeClass()} ${fullWidth ? 'industrial-tabs-fullwidth' : ''}`}
        role="tablist"
        aria-label={ariaLabel}
        ref={tabsRef}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
              else tabRefs.current.delete(tab.id);
            }}
            role="tab"
            aria-selected={activeTabId === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTabId === tab.id ? 0 : -1}
            className={`industrial-tab ${activeTabId === tab.id ? 'industrial-tab-active' : ''} ${tab.disabled ? 'industrial-tab-disabled' : ''} ${tabClassName}`}
            onClick={() => handleTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            disabled={tab.disabled}
          >
            {tab.icon && <span className="industrial-tab-icon">{tab.icon}</span>}
            <span className="industrial-tab-label">{tab.label}</span>
          </button>
        ))}
        <div className="industrial-tabs-indicator"></div>
      </div>
      
      {/* Tab Content */}
      {renderActiveContent()}
    </div>
  );
};

export default IndustrialTabs;
