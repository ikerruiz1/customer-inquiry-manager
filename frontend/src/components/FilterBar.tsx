import React from 'react';
import {
  Search,
  Filter,
  Flame,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  DepartmentEnum,
  PriorityEnum,
  InquiryStatusEnum,
} from '../types/inquiry';
import type {
  InquiryFilters,
  Inquiry,
} from '../types/inquiry';

interface FilterBarProps {
  filters: InquiryFilters;
  onFilterChange: (newFilters: InquiryFilters) => void;
  inquiries: Inquiry[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  inquiries,
}) => {
  // Compute live facet counts
  const activeCount = inquiries.filter((i) => i.status !== InquiryStatusEnum.RESOLVED).length;
  const claimedCount = inquiries.filter((i) => i.status === InquiryStatusEnum.CLAIMED).length;
  const resolvedCount = inquiries.filter((i) => i.status === InquiryStatusEnum.RESOLVED).length;

  const getDeptCount = (dept: DepartmentEnum) =>
    inquiries.filter((i) => i.department === dept && (filters.statusTab === 'RESOLVED' ? i.status === InquiryStatusEnum.RESOLVED : i.status !== InquiryStatusEnum.RESOLVED)).length;

  const getPriorityCount = (p: PriorityEnum) =>
    inquiries.filter((i) => i.priority === p && (filters.statusTab === 'RESOLVED' ? i.status === InquiryStatusEnum.RESOLVED : i.status !== InquiryStatusEnum.RESOLVED)).length;

  const churnCount = inquiries.filter((i) => i.churn_risk && (filters.statusTab === 'RESOLVED' ? i.status === InquiryStatusEnum.RESOLVED : i.status !== InquiryStatusEnum.RESOLVED)).length;

  const handleResetFilters = () => {
    onFilterChange({
      statusTab: 'ACTIVE',
      department: 'ALL',
      priority: 'ALL',
      churnOnly: false,
      searchQuery: '',
    });
  };

  return (
    <div
      style={{
        backgroundColor: '#090d15',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.6rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.55rem',
      }}
    >
      {/* Row 1: State Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* State Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            onClick={() => onFilterChange({ ...filters, statusTab: 'ACTIVE' })}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filters.statusTab === 'ACTIVE' ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
              background: filters.statusTab === 'ACTIVE' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-surface)',
              color: filters.statusTab === 'ACTIVE' ? '#93c5fd' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
            Active Queue ({activeCount})
          </button>

          <button
            onClick={() => onFilterChange({ ...filters, statusTab: 'IN_PROGRESS' })}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filters.statusTab === 'IN_PROGRESS' ? '1px solid #f59e0b' : '1px solid var(--border-subtle)',
              background: filters.statusTab === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-surface)',
              color: filters.statusTab === 'IN_PROGRESS' ? '#fcd34d' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            In Progress ({claimedCount})
          </button>

          <button
            onClick={() => onFilterChange({ ...filters, statusTab: 'RESOLVED' })}
            style={{
              padding: '0.35rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: filters.statusTab === 'RESOLVED' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
              background: filters.statusTab === 'RESOLVED' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
              color: filters.statusTab === 'RESOLVED' ? '#6ee7b7' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            Resolved History ({resolvedCount})
          </button>
        </div>

        {/* Search Input */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            minWidth: '240px',
            flex: '1',
            maxWidth: '380px',
          }}
        >
          <Search
            size={14}
            color="var(--text-dim)"
            style={{ position: 'absolute', left: '0.65rem' }}
          />
          <input
            type="text"
            placeholder="Search by sender, subject, or keyword..."
            value={filters.searchQuery}
            onChange={(e) =>
              onFilterChange({ ...filters, searchQuery: e.target.value })
            }
            style={{
              width: '100%',
              padding: '0.35rem 0.65rem 0.35rem 2rem',
              borderRadius: '6px',
              border: '1px solid var(--border-prominent)',
              background: 'var(--bg-input)',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Row 2: Department & Priority Facet Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>
            <Filter size={11} style={{ display: 'inline', marginRight: '3px' }} />
            DEPT:
          </span>

          <button
            onClick={() => onFilterChange({ ...filters, department: 'ALL' })}
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: (!filters.department || filters.department === 'ALL') ? '#3b82f6' : 'var(--border-subtle)',
              background: (!filters.department || filters.department === 'ALL') ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: (!filters.department || filters.department === 'ALL') ? '#93c5fd' : 'var(--text-muted)',
            }}
          >
            All
          </button>

          {Object.values(DepartmentEnum).map((dept) => {
            const isSelected = filters.department === dept;
            const count = getDeptCount(dept);
            return (
              <button
                key={dept}
                onClick={() =>
                  onFilterChange({
                    ...filters,
                    department: isSelected ? 'ALL' : dept,
                  })
                }
                style={{
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isSelected ? '#3b82f6' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  color: isSelected ? '#93c5fd' : 'var(--text-muted)',
                }}
              >
                {dept} ({count})
              </button>
            );
          })}
        </div>

        {/* Priority & Churn Alert Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600 }}>
            PRIORITY:
          </span>

          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                priority: filters.priority === PriorityEnum.P1 ? 'ALL' : PriorityEnum.P1,
              })
            }
            className={`btn ${filters.priority === PriorityEnum.P1 ? 'badge-p1' : ''}`}
            style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.72rem',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: filters.priority === PriorityEnum.P1 ? 'rgba(239, 68, 68, 0.3)' : 'transparent',
              color: '#fca5a5',
            }}
          >
            <Flame size={12} />
            Solo P1 ({getPriorityCount(PriorityEnum.P1)})
          </button>

          <button
            onClick={() =>
              onFilterChange({
                ...filters,
                priority: filters.priority === PriorityEnum.P2 ? 'ALL' : PriorityEnum.P2,
              })
            }
            className={`btn ${filters.priority === PriorityEnum.P2 ? 'badge-p2' : ''}`}
            style={{
              padding: '0.2rem 0.55rem',
              fontSize: '0.72rem',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              background: filters.priority === PriorityEnum.P2 ? 'rgba(245, 158, 11, 0.3)' : 'transparent',
              color: '#fcd34d',
            }}
          >
            P2 ({getPriorityCount(PriorityEnum.P2)})
          </button>

          {/* Churn Risk Toggle */}
          <button
            onClick={() => onFilterChange({ ...filters, churnOnly: !filters.churnOnly })}
            className={`btn ${filters.churnOnly ? 'pulse-critical' : ''}`}
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.72rem',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              background: filters.churnOnly ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
              color: '#fca5a5',
              fontWeight: 600,
            }}
            title="Filter by churn risk"
          >
            <AlertTriangle size={12} />
            🚨 Churn Risk ({churnCount})
          </button>

          {/* Reset button */}
          {(filters.department !== 'ALL' || filters.priority !== 'ALL' || filters.churnOnly || filters.searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
              title="Reset all filters"
            >
              <RotateCcw size={11} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
