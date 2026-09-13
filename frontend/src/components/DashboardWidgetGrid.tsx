import React, { useState, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import type { KPIStats, Inquiry, AgentProfile, DashboardMetricsResponse } from '../types/inquiry';
import {
  TasklySlaCard,
  TasklyMttrCard,
  TasklyDomainBarChart,
  TasklyPriorityBarChart,
  TasklySourcesBarChart,
  TasklySentimentBarChart,
} from './TasklyHeroVisualizations';
import { LoadLogicQueueTable, type QueueTab } from './LoadLogicQueueTable';

export type WidgetId =
  | 'kpi_sla'
  | 'kpi_mttr'
  | 'domain_distribution'
  | 'priority_distribution'
  | 'sources_distribution'
  | 'sentiment_distribution'
  | 'queue_table'
  | 'kpi_gauges'
  | 'sla_matrix'
  | 'bedrock_routing';

const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'kpi_sla',
  'kpi_mttr',
  'domain_distribution',
  'priority_distribution',
  'sources_distribution',
  'sentiment_distribution',
  'queue_table',
];
const STORAGE_KEY = 'enterprise_widget_order_v8';

interface DashboardWidgetGridProps {
  kpis: KPIStats;
  inquiries: Inquiry[];
  selectedTicket: Inquiry | null;
  onSelectTicket: (ticket: Inquiry) => void;
  currentAgent: AgentProfile;
  onClaimTicket: (ticketId: string) => void;
  isClaiming: boolean;
  activeTab: QueueTab;
  onTabChange: (tab: QueueTab) => void;
  onLayoutChange?: (isCustom: boolean) => void;
  resetSignal?: number;
  dashboardMetrics?: DashboardMetricsResponse | null;
  operators?: AgentProfile[];
}

export const DashboardWidgetGrid: React.FC<DashboardWidgetGridProps> = ({
  kpis,
  inquiries,
  selectedTicket,
  onSelectTicket,
  currentAgent,
  onClaimTicket,
  isClaiming,
  activeTab,
  onTabChange,
  onLayoutChange,
  resetSignal,
  dashboardMetrics,
  operators,
}) => {
  const [widgets, setWidgets] = useState<WidgetId[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as WidgetId[];
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_WIDGET_ORDER.length &&
          DEFAULT_WIDGET_ORDER.every((id) => parsed.includes(id))
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse error and fallback to default
    }
    return DEFAULT_WIDGET_ORDER;
  });

  const [draggedId, setDraggedId] = useState<WidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<WidgetId | null>(null);

  // Notify parent if layout is customized vs default
  useEffect(() => {
    const isCustom = JSON.stringify(widgets) !== JSON.stringify(DEFAULT_WIDGET_ORDER);
    if (onLayoutChange) {
      onLayoutChange(isCustom);
    }
  }, [widgets, onLayoutChange]);

  // Handle external reset signal from top bar
  useEffect(() => {
    if (resetSignal && resetSignal > 0) {
      setWidgets(DEFAULT_WIDGET_ORDER);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [resetSignal]);

  const handleDragStart = (e: React.DragEvent, id: WidgetId) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragEnter = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      setDragOverId(targetId);
    }
  };

  const handleDragOver = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== targetId && dragOverId !== targetId) {
      setDragOverId(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    // Ignore dragleave if cursor transitions within children of currentTarget
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    if (dragOverId === targetId) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentOrder = [...widgets];
    const sourceIndex = currentOrder.indexOf(draggedId);
    const targetIndex = currentOrder.indexOf(targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      currentOrder.splice(sourceIndex, 1);
      currentOrder.splice(targetIndex, 0, draggedId);
      setWidgets(currentOrder);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentOrder));
      } catch {
        // ignore localStorage quota error
      }
    }

    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const getWidgetTitle = (id: WidgetId): string => {
    switch (id) {
      case 'kpi_sla':
        return 'SLA Compliance Rate';
      case 'kpi_mttr':
        return 'AI MTTR Resolution Velocity';
      case 'domain_distribution':
      case 'bedrock_routing':
        return 'Total Inquiries by Domain Type';
      case 'priority_distribution':
        return 'Inquiries by Priority Tier & SLA Health';
      case 'sources_distribution':
        return 'Inquiries by Ingestion Channel';
      case 'sentiment_distribution':
        return 'Customer Sentiment & Churn Risk';
      case 'queue_table':
        return 'Inquiries Queue Table';
      default:
        return 'Widget';
    }
  };

  const renderDragHandle = (id: WidgetId) => (
    <div
      className="widget-drag-handle"
      title="Click and drag to reorder widget"
      draggable={true}
      onDragStart={(e) => handleDragStart(e, id)}
      onDragEnd={handleDragEnd}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        backgroundColor: draggedId === id ? '#0C0D0D' : 'rgba(255, 255, 255, 0.95)',
        color: draggedId === id ? '#FFFFFF' : '#6B7280',
        border: '1px solid rgba(12, 13, 13, 0.12)',
        cursor: draggedId === id ? 'grabbing' : 'grab',
        userSelect: 'none',
        boxShadow: '0 1px 3px rgba(12, 13, 13, 0.04)',
        transition: 'all 0.15s ease',
      }}
    >
      <GripVertical size={15} color={draggedId === id ? '#FFFFFF' : '#6B7280'} />
    </div>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
        width: '100%',
        alignItems: 'start',
      }}
    >
      {widgets.map((id) => {
        const isDragging = draggedId === id;
        const isDragOver = dragOverId === id && draggedId !== id;
        const isFullWidth = id === 'queue_table';

        return (
          <div
            key={id}
            onDragOver={(e) => handleDragOver(e, id)}
            onDragEnter={(e) => handleDragEnter(e, id)}
            onDragLeave={(e) => handleDragLeave(e, id)}
            onDrop={(e) => handleDrop(e, id)}
            className={`widget-draggable-card ${isDragging ? 'is-dragging' : ''}`}
            style={{
              position: 'relative',
              gridColumn: isFullWidth ? '1 / -1' : 'auto',
              width: '100%',
              borderRadius: '24px',
              transition: 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 0.2s ease',
            }}
          >
            {/* Live Drop Target Preview Box with prominent dotted/dashed boundary & high-contrast frosted backdrop */}
            {isDragOver && (
              <div
                className="widget-drop-placeholder"
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '24px',
                  border: '3px dashed #047857',
                  backgroundColor: 'rgba(246, 250, 247, 0.95)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 40,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxSizing: 'border-box',
                  boxShadow: '0 12px 36px rgba(4, 120, 87, 0.15)',
                  animation: 'pulseDropSlot 1.5s ease-in-out infinite alternate',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    borderRadius: '9999px',
                    backgroundColor: '#047857',
                    color: '#FFFFFF',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    boxShadow: '0 8px 24px rgba(4, 120, 87, 0.28)',
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      animation: 'dropSlotArrow 0.85s ease-in-out infinite alternate',
                    }}
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                  <span>Drop here to place &quot;{draggedId ? getWidgetTitle(draggedId) : ''}&quot;</span>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#065F46',
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                  }}
                >
                  Release mouse to swap positions
                </span>
              </div>
            )}

            {/* 1. Top Row Left: SLA Compliance Rate Card (Individually Draggable) */}
            {id === 'kpi_sla' && (
              <TasklySlaCard
                kpis={kpis}
                inquiries={inquiries}
                dragHandle={renderDragHandle('kpi_sla')}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* 2. Top Row Right: AI MTTR Resolution Velocity Card (Individually Draggable) */}
            {id === 'kpi_mttr' && (
              <TasklyMttrCard
                kpis={kpis}
                inquiries={inquiries}
                dragHandle={renderDragHandle('kpi_mttr')}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* Legacy fallback if stored in cache */}
            {(id === 'kpi_gauges' || id === 'sla_matrix') && (
              <TasklySlaCard
                kpis={kpis}
                inquiries={inquiries}
                dragHandle={renderDragHandle(id)}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* 3. Middle Row Left: Domain Hatched Pill Bar Chart */}
            {(id === 'domain_distribution' || id === 'bedrock_routing') && (
              <TasklyDomainBarChart
                inquiries={inquiries}
                dragHandle={renderDragHandle('domain_distribution')}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* 4. Middle Row Right: Priority & SLA Hatched Pill Bar Chart */}
            {id === 'priority_distribution' && (
              <TasklyPriorityBarChart
                inquiries={inquiries}
                dragHandle={renderDragHandle('priority_distribution')}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* 5. Ingestion Channels / 4 Sources Creative Bar Chart (Half-Width) */}
            {id === 'sources_distribution' && (
              <TasklySourcesBarChart
                inquiries={inquiries}
                dragHandle={renderDragHandle('sources_distribution')}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* 6. Customer Sentiment & Churn Risk Analytics Bar Chart (Half-Width) */}
            {id === 'sentiment_distribution' && (
              <TasklySentimentBarChart
                inquiries={inquiries}
                dragHandle={renderDragHandle('sentiment_distribution')}
                dashboardMetrics={dashboardMetrics}
              />
            )}

            {/* 7. Lower Section: Inquiries Queue Table */}
            {id === 'queue_table' && (
              <div className="loadlogic-card" style={{ width: '100%' }}>
                <LoadLogicQueueTable
                  inquiries={inquiries}
                  selectedTicket={selectedTicket}
                  onSelectTicket={onSelectTicket}
                  currentAgent={currentAgent}
                  onClaimTicket={onClaimTicket}
                  isClaiming={isClaiming}
                  activeTab={activeTab}
                  onTabChange={onTabChange}
                  dragHandle={renderDragHandle('queue_table')}
                  operators={operators}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
