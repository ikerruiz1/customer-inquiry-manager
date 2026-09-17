import React, { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Zap,
  CreditCard,
  Mail,
  Star,
  Globe,
  ChevronDown,
  Check,
  Layers,
  ShieldAlert,
  Smile,
  Frown,
  Meh,
} from 'lucide-react';
import { DepartmentEnum, PriorityEnum, ChannelEnum } from '../types/inquiry';
import type { KPIStats, Inquiry, DashboardMetricsResponse } from '../types/inquiry';

// ==========================================
// 1. REUSABLE SEMI-CIRCLE ARC GAUGE COMPONENT
// Matching exact detail from user reference:
// Solid colored portion on left, fine diagonal
// hatch stripes on remaining arc, and raw bold
// '+10% ↑' text inside the inner concave cutout.
// ==========================================
interface SemiCircleGaugeProps {
  value: number; // 0 to 100
  color: string; // stroke color (e.g. '#5EA843', '#1E293B')
  hatchStroke: string; // hatch line color
  deltaText: string;
  arrowColor?: string;
}

export const SemiCircleGauge: React.FC<SemiCircleGaugeProps> = ({
  value,
  color,
  hatchStroke,
  deltaText,
  arrowColor,
}) => {
  // Semi-circle arc geometry:
  // Center: (65, 58), Radius: 44
  // Semi-circle path from (21, 58) to (109, 58)
  // Arc length = PI * 44 ≈ 138.23
  const radius = 44;
  const arcLength = Math.PI * radius;
  const clampedValue = Math.min(100, Math.max(5, value));
  const activeLength = (clampedValue / 100) * arcLength;
  const patternId = `hatch_${color.replace('#', '')}`;

  return (
    <div style={{ position: 'relative', width: '135px', height: '74px', display: 'flex', justifyContent: 'center' }}>
      <svg width="135" height="74" viewBox="0 0 130 68" style={{ overflow: 'visible' }}>
        <defs>
          <pattern
            id={patternId}
            width="5"
            height="5"
            patternTransform="rotate(-45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke={hatchStroke} strokeWidth="1.2" />
          </pattern>
        </defs>

        {/* 1. Full Track with fine diagonal stripes (The unreached portion) */}
        <path
          d="M 21 58 A 44 44 0 0 1 109 58"
          fill="none"
          stroke={`url(#${patternId})`}
          strokeWidth="15"
          strokeLinecap="round"
        />

        {/* 2. Active Solid Segment starting precisely from left at (21, 58) */}
        <path
          d="M 21 58 A 44 44 0 0 1 109 58"
          fill="none"
          stroke={color}
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={`${activeLength} ${arcLength}`}
          strokeDashoffset="0"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>

      {/* 3. Text directly beneath the active arc inside the inner curve */}
      <div
        style={{
          position: 'absolute',
          bottom: '5px',
          left: '52%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '3px',
          fontSize: '0.84rem',
          fontWeight: 800,
          color: '#111827',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>{deltaText}</span>
        <span style={{ color: arrowColor || color, fontSize: '0.84rem', fontWeight: 800 }}>↑</span>
      </div>
    </div>
  );
};

// ==========================================
// 2. TOP KPI CARD 1: SLA COMPLIANCE RATE
// Individually draggable with deep parameter breakdown
// ==========================================
interface TasklyKpiCardProps {
  kpis: KPIStats;
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
  dashboardMetrics?: DashboardMetricsResponse | null;
}

export const TasklySlaCard: React.FC<TasklyKpiCardProps> = ({ inquiries, dragHandle, dashboardMetrics: _dashboardMetrics }) => {
  const now = Date.now();
  const totalInquiries = inquiries.length || 1;
  const overdueCount = inquiries.filter(
    (t) => t.status !== 'RESOLVED' && new Date(t.sla_deadline_at).getTime() < now
  ).length;
  const inBoundsCount = inquiries.filter(
    (t) => t.status === 'RESOLVED' || new Date(t.sla_deadline_at).getTime() >= now
  ).length;
  const complianceRate = totalInquiries > 0
    ? Math.round((inBoundsCount / totalInquiries) * 100)
    : 100;

  return (
    <div
      className="loadlogic-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '235px',
        position: 'relative',
        boxSizing: 'border-box',
        height: '100%',
      }}
    >
      {/* Upper row: Icon + Title + Status badge + Drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(94, 168, 67, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={16} color="#5EA843" />
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'block' }}>
              SLA Compliance Rate
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              ITIL response & resolution deadline monitoring
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '9999px',
              backgroundColor: overdueCount === 0 ? 'rgba(94, 168, 67, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: overdueCount === 0 ? '#5EA843' : '#DC2626',
            }}
          >
            <span className="status-dot" style={{ backgroundColor: overdueCount === 0 ? '#5EA843' : '#DC2626' }} />
            <span>{overdueCount === 0 ? 'Optimal (≥95%)' : `${overdueCount} Breached`}</span>
          </div>
          {dragHandle}
        </div>
      </div>

      {/* Middle row: Big Metric + Arc Gauge */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '4px 0 10px 0' }}>
        <div>
          <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Active Operational Queue
          </span>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {complianceRate}%
          </div>
        </div>

        <SemiCircleGauge
          value={complianceRate}
          color="#5EA843"
          hatchStroke="#86EFAC"
          deltaText={`${complianceRate}%`}
          arrowColor="#5EA843"
        />
      </div>

      {/* Deep Parameter Breakdown Panel */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(12, 13, 13, 0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}
      >
        <div style={{ backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, display: 'block' }}>In-Bounds / Total</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#047857' }}>
            {inBoundsCount} <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>/ {totalInquiries} tkts</span>
          </span>
        </div>
        <div style={{ backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Breached (Overdue)</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: overdueCount > 0 ? '#DC2626' : '#10B981' }}>
            {overdueCount} <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>tkts</span>
          </span>
        </div>
        <div style={{ backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Target Threshold</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827' }}>
            ≥ 95.0% <span style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>ITIL Tier-1</span>
          </span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. TOP KPI CARD 2: AI MTTR RESOLUTION VELOCITY
// Individually draggable with deep parameter breakdown
// ==========================================
export const TasklyMttrCard: React.FC<TasklyKpiCardProps> = ({ inquiries, dragHandle, dashboardMetrics }) => {
  const now = Date.now();
  const totalInquiries = inquiries.length || 1;
  const resolvedTickets = inquiries.filter((t) => t.status === 'RESOLVED');
  const claimedOrResolved = inquiries.filter((t) => t.claimed_at);

  // 1. Live Backend SQL or Dynamic End-to-End MTTR
  const resolvedWithTimes = resolvedTickets.filter((t) => t.resolved_at);
  const avgMttr = dashboardMetrics?.kpis
    ? dashboardMetrics.kpis.avg_mttr_seconds
    : resolvedWithTimes.length > 0
      ? Number((
        resolvedWithTimes.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const closed = new Date(t.resolved_at!).getTime();
          return sum + Math.max(1, (closed - created) / 1000);
        }, 0) / resolvedWithTimes.length
      ).toFixed(2))
      : Number((
        inquiries.reduce((sum, t) => {
          return sum + Math.max(1, (now - new Date(t.created_at).getTime()) / 1000);
        }, 0) / totalInquiries
      ).toFixed(2));

  // 2. Dynamic Unit Ingestion Cost
  const avgUnitCost = (
    inquiries.reduce((sum, t) => sum + (t.cost_eur || 0.00025), 0) / totalInquiries
  ).toFixed(5);

  // 3. Dynamic Bedrock Inference Latency
  const validLatencies = inquiries
    .map((t) => t.bedrock_latency_ms ?? t.entities?.bedrock_latency_ms)
    .filter((l): l is number => typeof l === 'number' && l > 0);
  const avgBedrockLatency = validLatencies.length > 0
    ? (validLatencies.reduce((sum, l) => sum + l, 0) / validLatencies.length / 1000).toFixed(2)
    : '0.48';

  // 4. Dynamic Queue Dwell Average
  const avgDwellSeconds = claimedOrResolved.length > 0
    ? Math.round(
      claimedOrResolved.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const claimed = new Date(t.claimed_at!).getTime();
        return sum + Math.max(1, (claimed - created) / 1000);
      }, 0) / claimedOrResolved.length
    )
    : Math.round(avgMttr * 0.35);

  // 5. Dynamic Autonomous Routing Rate (% resolved verbatim or unedited)
  const verbatimApproved = resolvedTickets.filter((t) => t.was_edited === false).length;
  const zeroTouchPct = resolvedTickets.length > 0
    ? Math.round((verbatimApproved / resolvedTickets.length) * 100)
    : 100;

  // Velocity score for semi-circle arc (0 to 100, where lower MTTR gives higher velocity score)
  const velocityScore = Math.min(100, Math.max(15, Math.round(100 - (Math.min(avgMttr, 300) / 300) * 80)));

  return (
    <div
      className="loadlogic-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '235px',
        position: 'relative',
        boxSizing: 'border-box',
        height: '100%',
      }}
    >
      {/* Upper row: Icon + Title + FinOps pill + Drag handle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(17, 24, 39, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={16} color="#111827" />
          </div>
          <div>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', display: 'block' }}>
              AI MTTR Resolution Velocity
            </span>
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              Automated inference velocity & mean resolution time
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '9999px',
              backgroundColor: '#F1F5F9',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#475569',
            }}
          >
            <Zap size={10} color="#047857" />
            <span>{avgUnitCost} €/tkt</span>
          </div>
          {dragHandle}
        </div>
      </div>

      {/* Middle row: Big Metric + Arc Gauge */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '4px 0 10px 0' }}>
        <div>
          <span style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            {resolvedTickets.length > 0 ? 'Mean Time to Resolution' : 'Average Queue Dwell'}
          </span>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {avgMttr}<span style={{ fontSize: '1rem', fontWeight: 700, color: '#64748B', marginLeft: '3px' }}>s</span>
          </div>
        </div>

        <SemiCircleGauge
          value={velocityScore}
          color="#1E293B"
          hatchStroke="#CBD5E1"
          deltaText={`${avgMttr}s`}
          arrowColor="#1E293B"
        />
      </div>

      {/* Deep Parameter Breakdown Panel */}
      <div
        style={{
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(12, 13, 13, 0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
        }}
      >
        <div style={{ backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Inference Latency</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#111827' }}>
            ~{avgBedrockLatency}s <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>P95 Latency</span>
          </span>
        </div>
        <div style={{ backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Queue Dwell Avg</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4B5563' }}>
            ~{avgDwellSeconds}.0s <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Triage Wait</span>
          </span>
        </div>
        <div style={{ backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(12, 13, 13, 0.05)' }}>
          <span style={{ fontSize: '0.66rem', color: '#64748B', fontWeight: 600, display: 'block' }}>Autonomous Routing</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#047857' }}>
            {zeroTouchPct}% <span style={{ fontSize: '0.68rem', color: '#047857', fontWeight: 700 }}>Zero-Touch</span>
          </span>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// 4. TASKLY CHART 1: TOTAL INQUIRIES BY DOMAIN TYPE
// Features interactive dropdown filter and mathematically coherent dynamic Y-axis
// ==========================================
interface TasklyDomainBarChartProps {
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
  dashboardMetrics?: DashboardMetricsResponse | null;
}

export const TasklyDomainBarChart: React.FC<TasklyDomainBarChartProps> = ({ inquiries, dragHandle, dashboardMetrics }) => {
  const [selectedRange, setSelectedRange] = useState<'Current Shift' | 'Last 24 Hours' | 'Last 7 Days' | 'Last 8 Weeks'>('Current Shift');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [activeDept, setActiveDept] = useState<DepartmentEnum | null>(null);

  // Close filter dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const departmentCounts: Record<DepartmentEnum, number> = {
    [DepartmentEnum.TECH_SUPPORT]: dashboardMetrics?.distributions?.departments?.['TECH_SUPPORT'] ?? 0,
    [DepartmentEnum.BILLING]: dashboardMetrics?.distributions?.departments?.['BILLING'] ?? 0,
    [DepartmentEnum.SECURITY]: dashboardMetrics?.distributions?.departments?.['SECURITY'] ?? 0,
    [DepartmentEnum.ACCOUNTS]: dashboardMetrics?.distributions?.departments?.['ACCOUNTS'] ?? 0,
    [DepartmentEnum.SALES]: dashboardMetrics?.distributions?.departments?.['SALES'] ?? 0,
    [DepartmentEnum.GENERAL]: dashboardMetrics?.distributions?.departments?.['GENERAL'] ?? 0,
  };

  if (!dashboardMetrics?.distributions?.departments) {
    inquiries.forEach((ticket) => {
      if (departmentCounts[ticket.department] !== undefined) {
        departmentCounts[ticket.department]++;
      }
    });
  }

  // Dynamic dataset counts for each time range option based on real ticket timestamps:
  const getDomainCountsForRange = (range: typeof selectedRange) => {
    const cutoffNow = Date.now();
    let filteredInquiries = inquiries;

    if (range === 'Current Shift') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 8 * 3600 * 1000
      );
    } else if (range === 'Last 24 Hours') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 24 * 3600 * 1000
      );
    } else if (range === 'Last 7 Days') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 7 * 24 * 3600 * 1000
      );
    }
    // Fallback if the demo seed dataset has older timestamps: show all inquiries
    if (filteredInquiries.length === 0) {
      filteredInquiries = inquiries;
    }

    const counts: Record<DepartmentEnum, number> = {
      [DepartmentEnum.TECH_SUPPORT]: 0,
      [DepartmentEnum.BILLING]: 0,
      [DepartmentEnum.SECURITY]: 0,
      [DepartmentEnum.ACCOUNTS]: 0,
      [DepartmentEnum.SALES]: 0,
      [DepartmentEnum.GENERAL]: 0,
    };

    filteredInquiries.forEach((ticket) => {
      if (counts[ticket.department] !== undefined) {
        counts[ticket.department]++;
      }
    });

    return counts;
  };


  const activeCounts = getDomainCountsForRange(selectedRange);

  // 6 Distinct Colors for each Domain:
  const rawColumns = [
    {
      dept: DepartmentEnum.TECH_SUPPORT,
      label: 'Tech Support',
      short: 'Tech',
      count: activeCounts[DepartmentEnum.TECH_SUPPORT],
      color: '#2563EB',
      hatchLight: '#93C5FD',
      bgLight: '#EFF6FF',
    },
    {
      dept: DepartmentEnum.BILLING,
      label: 'Billing Disputes',
      short: 'Billing',
      count: activeCounts[DepartmentEnum.BILLING],
      color: '#10B981',
      hatchLight: '#6EE7B7',
      bgLight: '#ECFDF5',
    },
    {
      dept: DepartmentEnum.SECURITY,
      label: 'Security & Auth',
      short: 'Security',
      count: activeCounts[DepartmentEnum.SECURITY],
      color: '#1E293B',
      hatchLight: '#94A3B8',
      bgLight: '#F1F5F9',
    },
    {
      dept: DepartmentEnum.ACCOUNTS,
      label: 'Enterprise Accounts',
      short: 'Accounts',
      count: activeCounts[DepartmentEnum.ACCOUNTS],
      color: '#D97706',
      hatchLight: '#FCD34D',
      bgLight: '#FEF3C7',
    },
    {
      dept: DepartmentEnum.SALES,
      label: 'Sales Inquiries',
      short: 'Sales',
      count: activeCounts[DepartmentEnum.SALES],
      color: '#7C3AED',
      hatchLight: '#C4B5FD',
      bgLight: '#F5F3FF',
    },
    {
      dept: DepartmentEnum.GENERAL,
      label: 'General Care',
      short: 'General',
      count: activeCounts[DepartmentEnum.GENERAL],
      color: '#E11D48',
      hatchLight: '#FDA4AF',
      bgLight: '#FFF1F2',
    },
  ];

  const totalInquiries = rawColumns.reduce((sum, c) => sum + c.count, 0);
  const maxVal = Math.max(...rawColumns.map((c) => c.count), 4);

  // Dynamically calculated Y-axis ticks
  const yAxisTicks = [
    maxVal,
    Math.round(maxVal * 0.75),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.25),
    0,
  ];

  const columns = rawColumns.map((col) => {
    const heightPct = Math.max(14, Math.round((col.count / maxVal) * 85));
    const pct = Math.round((col.count / totalInquiries) * 100);
    return {
      ...col,
      heightPct,
      pct,
    };
  });

  return (
    <div
      className="loadlogic-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
            Total Inquiries by Domain Type
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            Autonomous ticket classification across enterprise domains
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Real Interactive Dropdown Menu */}
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <span>{selectedRange}</span>
              <ChevronDown size={12} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {filterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '180px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid rgba(12, 13, 13, 0.1)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {(['Current Shift', 'Last 24 Hours', 'Last 7 Days', 'Last 8 Weeks'] as const).map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      setSelectedRange(opt);
                      setFilterOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: selectedRange === opt ? '#ECF4EE' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: selectedRange === opt ? 800 : 600,
                      color: selectedRange === opt ? '#047857' : '#111827',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    <span>{opt}</span>
                    {selectedRange === opt && <Check size={13} color="#047857" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {dragHandle}
        </div>
      </div>

      {/* SVG Chart Area with Dotted Guide Lines and Hatched Pill Bars */}
      <div style={{ position: 'relative', width: '100%', height: '175px', marginTop: '10px' }}>
        {/* Horizontal Dotted Guide Lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            paddingBottom: '24px',
          }}
        >
          {yAxisTicks.map((val, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span style={{ width: '28px', fontSize: '0.66rem', color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>
                {val}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  borderTop: i === yAxisTicks.length - 1 ? '1px solid #CBD5E1' : '1px dashed #E2E8F0',
                }}
              />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          onMouseLeave={() => setActiveDept(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            top: '8px',
            bottom: '24px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
          }}
        >
          {columns.map((col) => {
            const isActive = col.dept === activeDept;
            return (
              <div
                key={col.label}
                onClick={() => setActiveDept((prev) => (prev === col.dept ? null : col.dept))}
                onMouseEnter={() => setActiveDept(col.dept)}
                onMouseLeave={() => setActiveDept(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* Floating Black Tooltip Capsule above active bar */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${Math.max(0, 100 - col.heightPct - 24)}%`,
                      backgroundColor: '#111827',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.24)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: col.color,
                      }}
                    />
                    <span>{col.count} Inquiries ({col.pct}%)</span>
                  </div>
                )}

                {/* Hatched Pill Bar with Unique Colors */}
                <div
                  style={{
                    width: '34px',
                    height: `${col.heightPct}%`,
                    borderRadius: '9999px',
                    backgroundColor: isActive ? col.color : col.bgLight,
                    backgroundImage: isActive
                      ? 'none'
                      : `repeating-linear-gradient(45deg, ${col.hatchLight}, ${col.hatchLight} 2px, transparent 2px, transparent 6px)`,
                    border: isActive ? `1.5px solid ${col.color}` : `1.5px solid ${col.color}45`,
                    transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    position: 'relative',
                    boxShadow: isActive ? `0 6px 18px ${col.color}55` : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                  }}
                  title={`${col.label}: ${col.count} inquiries`}
                >
                  {/* Active center dot at the top of the highlighted bar */}
                  {isActive && (
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        margin: '6px auto 0 auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div
          onMouseLeave={() => setActiveDept(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            bottom: '0px',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          {columns.map((col) => {
            const isActive = col.dept === activeDept;
            return (
              <span
                key={col.label}
                onClick={() => setActiveDept((prev) => (prev === col.dept ? null : col.dept))}
                onMouseEnter={() => setActiveDept(col.dept)}
                onMouseLeave={() => setActiveDept(null)}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#111827' : '#64748B',
                  width: '45px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
              >
                {col.short}
              </span>
            );
          })}
        </div>
      </div>

      {/* Domain Legend Grid: Interactive category cards */}
      <div
        onMouseLeave={() => setActiveDept(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(12, 13, 13, 0.05)',
        }}
      >
        {columns.map((col) => {
          const isActive = col.dept === activeDept;
          return (
            <div
              key={col.label}
              onClick={() => setActiveDept((prev) => (prev === col.dept ? null : col.dept))}
              onMouseEnter={() => setActiveDept(col.dept)}
              onMouseLeave={() => setActiveDept(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 9px',
                borderRadius: '8px',
                backgroundColor: isActive ? '#FFFFFF' : '#F8FAFC',
                border: isActive ? `1.5px solid ${col.color}` : '1px solid rgba(12, 13, 13, 0.06)',
                fontSize: '0.7rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 2px 8px ${col.color}25` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: col.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, color: '#111827' }}>{col.short}</span>
              </div>
              <span style={{ fontWeight: 700, color: isActive ? col.color : '#64748B' }}>
                {col.count} <span style={{ fontSize: '0.64rem', opacity: 0.85 }}>({col.pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 5. TASKLY CHART 2: INQUIRIES BY PRIORITY TIER & SLA HEALTH
// Features interactive dropdown filter and mathematically coherent dynamic Y-axis
// ==========================================
interface TasklyPriorityBarChartProps {
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
  dashboardMetrics?: DashboardMetricsResponse | null;
}

export const TasklyPriorityBarChart: React.FC<TasklyPriorityBarChartProps> = ({ inquiries, dragHandle, dashboardMetrics: _dashboardMetrics }) => {
  const [selectedRange, setSelectedRange] = useState<'Active Queue' | 'Shift SLA' | 'All Time'>('Active Queue');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [activeTier, setActiveTier] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const now = Date.now();

  // Dynamic metrics computed from live inquiry dataset:
  const getPriorityCountsForRange = (mode: typeof selectedRange) => {
    let pool = inquiries;
    if (mode === 'Active Queue') {
      pool = inquiries.filter((t) => t.status !== 'RESOLVED');
    }

    const p1 = pool.filter((t) => t.priority === PriorityEnum.P1).length;
    const p2 = pool.filter((t) => t.priority === PriorityEnum.P2).length;
    const p3 = pool.filter((t) => t.priority === PriorityEnum.P3).length;
    const p4 = pool.filter((t) => t.priority === PriorityEnum.P4).length;
    const inBounds = pool.filter(
      (t) => t.status === 'RESOLVED' || new Date(t.sla_deadline_at).getTime() >= now
    ).length;

    switch (mode) {
      case 'Shift SLA':
        return {
          p1,
          p2,
          p3,
          p4,
          inBounds,
          fifthLabel: 'Shift SLA Met',
          fifthShort: 'SLA Met',
        };
      case 'All Time':
        return {
          p1,
          p2,
          p3,
          p4,
          inBounds,
          fifthLabel: 'All-Time In-Bounds',
          fifthShort: 'Compliant',
        };
      case 'Active Queue':
      default:
        return {
          p1,
          p2,
          p3,
          p4,
          inBounds,
          fifthLabel: 'SLA In-Bounds',
          fifthShort: 'In-Bounds',
        };
    }
  };

  const priorityData = getPriorityCountsForRange(selectedRange);


  // 5 Distinct Colors for Priority & SLA categories:
  const rawColumns = [
    {
      label: 'P1 Emergency',
      short: 'P1 Crit',
      count: priorityData.p1,
      color: '#DC2626',
      hatchLight: '#FCA5A5',
      bgLight: '#FEF2F2',
    },
    {
      label: 'P2 High',
      short: 'P2 High',
      count: priorityData.p2,
      color: '#F59E0B',
      hatchLight: '#FDE68A',
      bgLight: '#FFFBEB',
    },
    {
      label: 'P3 Medium',
      short: 'P3 Med',
      count: priorityData.p3,
      color: '#2563EB',
      hatchLight: '#BFDBFE',
      bgLight: '#EFF6FF',
    },
    {
      label: 'P4 Low',
      short: 'P4 Low',
      count: priorityData.p4,
      color: '#64748B',
      hatchLight: '#CBD5E1',
      bgLight: '#F8FAFC',
    },
    {
      label: priorityData.fifthLabel,
      short: priorityData.fifthShort,
      count: priorityData.inBounds,
      color: '#10B981',
      hatchLight: '#6EE7B7',
      bgLight: '#ECFDF5',
    },
  ];

  const currentTotal = rawColumns.reduce((acc, c) => acc + c.count, 0);
  const maxVal = Math.max(...rawColumns.map((c) => c.count), 6);
  const yAxisTicks = [
    maxVal,
    Math.round(maxVal * 0.75),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.25),
    0,
  ];

  const columns = rawColumns.map((col) => {
    const heightPct = Math.max(14, Math.round((col.count / maxVal) * 85));
    const pct = Math.round((col.count / currentTotal) * 100);
    return {
      ...col,
      heightPct,
      pct,
    };
  });

  return (
    <div
      className="loadlogic-card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
            Inquiries by Priority Tier & SLA Health
          </h3>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            ITIL severity tiering and SLA deadline tracking
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Dropdown Menu */}
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <span>{selectedRange}</span>
              <ChevronDown size={12} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {filterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '160px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid rgba(12, 13, 13, 0.1)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {(['Active Queue', 'Shift SLA', 'All Time'] as const).map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      setSelectedRange(opt);
                      setFilterOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: selectedRange === opt ? '#ECF4EE' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: selectedRange === opt ? 800 : 600,
                      color: selectedRange === opt ? '#047857' : '#111827',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    <span>{opt}</span>
                    {selectedRange === opt && <Check size={13} color="#047857" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {dragHandle}
        </div>
      </div>

      {/* SVG Chart Area with Dotted Guide Lines and Hatched Pill Bars */}
      <div style={{ position: 'relative', width: '100%', height: '175px', marginTop: '10px' }}>
        {/* Horizontal Dotted Guide Lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            paddingBottom: '24px',
          }}
        >
          {yAxisTicks.map((val, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span style={{ width: '28px', fontSize: '0.66rem', color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>
                {val}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  borderTop: i === yAxisTicks.length - 1 ? '1px solid #CBD5E1' : '1px dashed #E2E8F0',
                }}
              />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          onMouseLeave={() => setActiveTier(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            top: '8px',
            bottom: '24px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
          }}
        >
          {columns.map((col) => {
            const isActive = col.label === activeTier;
            return (
              <div
                key={col.label}
                onClick={() => setActiveTier((prev) => (prev === col.label ? null : col.label))}
                onMouseEnter={() => setActiveTier(col.label)}
                onMouseLeave={() => setActiveTier(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* Floating Black Tooltip Capsule above active bar */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${Math.max(0, 100 - col.heightPct - 24)}%`,
                      backgroundColor: '#111827',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.24)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: col.color,
                      }}
                    />
                    <span>{col.count} Inquiries ({col.pct}%)</span>
                  </div>
                )}

                {/* Hatched Pill Bar with Unique Colors */}
                <div
                  style={{
                    width: '34px',
                    height: `${col.heightPct}%`,
                    borderRadius: '9999px',
                    backgroundColor: isActive ? col.color : col.bgLight,
                    backgroundImage: isActive
                      ? 'none'
                      : `repeating-linear-gradient(45deg, ${col.hatchLight}, ${col.hatchLight} 2px, transparent 2px, transparent 6px)`,
                    border: isActive ? `1.5px solid ${col.color}` : `1.5px solid ${col.color}45`,
                    transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    position: 'relative',
                    boxShadow: isActive ? `0 6px 18px ${col.color}55` : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                  }}
                  title={`${col.label}: ${col.count} active inquiries`}
                >
                  {/* Active center dot at the top of the highlighted bar */}
                  {isActive && (
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        margin: '6px auto 0 auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div
          onMouseLeave={() => setActiveTier(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            bottom: '0px',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          {columns.map((col) => {
            const isActive = col.label === activeTier;
            return (
              <span
                key={col.label}
                onClick={() => setActiveTier((prev) => (prev === col.label ? null : col.label))}
                onMouseEnter={() => setActiveTier(col.label)}
                onMouseLeave={() => setActiveTier(null)}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#111827' : '#64748B',
                  width: '50px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
              >
                {col.short}
              </span>
            );
          })}
        </div>
      </div>

      {/* Priority Legend Grid: Interactive category cards */}
      <div
        onMouseLeave={() => setActiveTier(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '8px',
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(12, 13, 13, 0.05)',
        }}
      >
        {columns.map((col) => {
          const isActive = col.label === activeTier;
          return (
            <div
              key={col.label}
              onClick={() => setActiveTier((prev) => (prev === col.label ? null : col.label))}
              onMouseEnter={() => setActiveTier(col.label)}
              onMouseLeave={() => setActiveTier(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 8px',
                borderRadius: '8px',
                backgroundColor: isActive ? '#FFFFFF' : '#F8FAFC',
                border: isActive ? `1.5px solid ${col.color}` : '1px solid rgba(12, 13, 13, 0.06)',
                fontSize: '0.7rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 2px 8px ${col.color}25` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: col.color }} />
                <span style={{ fontWeight: 700, color: '#111827' }}>{col.short}</span>
              </div>
              <span style={{ fontWeight: 800, color: isActive ? col.color : '#64748B' }}>
                {col.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 6. TASKLY CHART 3: INQUIRIES BY INGESTION CHANNEL (4 SOURCES)
// ==========================================
interface TasklySourcesBarChartProps {
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
  dashboardMetrics?: DashboardMetricsResponse | null;
}

export const TasklySourcesBarChart: React.FC<TasklySourcesBarChartProps> = ({ inquiries, dragHandle, dashboardMetrics: _dashboardMetrics }) => {
  const [selectedRange, setSelectedRange] = useState<'Current Shift' | 'Last 24 Hours' | 'Last 7 Days' | 'Last 8 Weeks'>('Current Shift');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Distinct dataset counts for each time range option based on real inquiry timestamps:
  const getSourcesCountsForRange = (range: typeof selectedRange) => {
    const cutoffNow = Date.now();
    let filteredInquiries = inquiries;

    if (range === 'Current Shift') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 8 * 3600 * 1000
      );
    } else if (range === 'Last 24 Hours') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 24 * 3600 * 1000
      );
    } else if (range === 'Last 7 Days') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 7 * 24 * 3600 * 1000
      );
    }
    if (filteredInquiries.length === 0) {
      filteredInquiries = inquiries;
    }

    return {
      stripe: filteredInquiries.filter(
        (t) => t.channel === ChannelEnum.BILLING || (t.channel as any) === 'STRIPE'
      ).length,
      email: filteredInquiries.filter((t) => t.channel === ChannelEnum.EMAIL).length,
      trustpilot: filteredInquiries.filter((t) => t.channel === ChannelEnum.TRUSTPILOT).length,
      webForm: filteredInquiries.filter((t) => t.channel === ChannelEnum.WEB_FORM).length,
    };
  };

  const activeSourcesCounts = getSourcesCountsForRange(selectedRange);

  const channels = [
    {
      id: 'STRIPE',
      label: 'Stripe Disputes Webhook',
      short: 'Stripe',
      icon: CreditCard,
      count: activeSourcesCounts.stripe,
      color: '#6366F1', // Indigo
      hatchLight: '#A5B4FC',
      bgLight: '#EEF2FF',
      type: 'Webhook Event',
    },
    {
      id: 'EMAIL',
      label: 'Support Inbound Email',
      short: 'Email',
      icon: Mail,
      count: activeSourcesCounts.email,
      color: '#0EA5E9', // Sky Blue
      hatchLight: '#7DD3FC',
      bgLight: '#F0F9FF',
      type: 'SES Ingestion',
    },
    {
      id: 'TRUSTPILOT',
      label: 'Trustpilot Reviews Webhook',
      short: 'Trustpilot',
      icon: Star,
      count: activeSourcesCounts.trustpilot,
      color: '#10B981', // Emerald
      hatchLight: '#6EE7B7',
      bgLight: '#ECFDF5',
      type: 'Webhook Stream',
    },
    {
      id: 'WEB_FORM',
      label: 'Customer Web Portal',
      short: 'Web Form',
      icon: Globe,
      count: activeSourcesCounts.webForm,
      color: '#F59E0B', // Amber
      hatchLight: '#FDE68A',
      bgLight: '#FFFBEB',
      type: 'REST API Ingress',
    },
  ];

  const currentTotal = channels.reduce((acc, c) => acc + c.count, 0);
  const maxVal = Math.max(...channels.map((c) => c.count), 4);
  const yAxisTicks = [
    maxVal,
    Math.round(maxVal * 0.75),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.25),
    0,
  ];

  return (
    <div
      className="loadlogic-card"
      style={{
        padding: '14px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Layers size={15} color="#6366F1" />
          </div>
          <div>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
              Inquiries by Ingestion Channel
            </h3>
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              Multi-channel intake across Stripe, Email, Trustpilot & Web Form
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Dropdown Time Filter */}
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <span>{selectedRange}</span>
              <ChevronDown size={12} style={{ transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {filterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '180px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid rgba(12, 13, 13, 0.1)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {(['Current Shift', 'Last 24 Hours', 'Last 7 Days', 'Last 8 Weeks'] as const).map((opt) => (
                  <div
                    key={opt}
                    onClick={() => {
                      setSelectedRange(opt);
                      setFilterOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      backgroundColor: selectedRange === opt ? '#ECF4EE' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      fontWeight: selectedRange === opt ? 800 : 600,
                      color: selectedRange === opt ? '#047857' : '#111827',
                      transition: 'background-color 0.12s ease',
                    }}
                  >
                    <span>{opt}</span>
                    {selectedRange === opt && <Check size={13} color="#047857" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {dragHandle}
        </div>
      </div>

      {/* SVG Chart Area with Dotted Guide Lines and Hatched Pill Bars (Compact 110px) */}
      <div style={{ position: 'relative', width: '100%', height: '110px', marginTop: '6px' }}>
        {/* Horizontal Dotted Guide Lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            paddingBottom: '20px',
          }}
        >
          {yAxisTicks.map((val, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span style={{ width: '28px', fontSize: '0.64rem', color: '#94A3B8', fontWeight: 600, textAlign: 'right' }}>
                {val}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  borderTop: i === yAxisTicks.length - 1 ? '1px solid #CBD5E1' : '1px dashed #E2E8F0',
                }}
              />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          onMouseLeave={() => setActiveSource(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            top: '6px',
            bottom: '20px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
          }}
        >
          {channels.map((col) => {
            const isActive = col.id === activeSource;
            const heightPct = Math.max(14, Math.round((col.count / maxVal) * 85));
            const pct = Math.round((col.count / currentTotal) * 100);
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                onClick={() => setActiveSource((prev) => (prev === col.id ? null : col.id))}
                onMouseEnter={() => setActiveSource(col.id)}
                onMouseLeave={() => setActiveSource(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* Floating Black Tooltip Capsule above active bar */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${Math.max(0, 100 - heightPct - 24)}%`,
                      backgroundColor: '#111827',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.24)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Icon size={11} color={col.color} />
                    <span>{col.count} Inquiries ({pct}%)</span>
                  </div>
                )}

                {/* Hatched Pill Bar with Unique Colors (Compact Width) */}
                <div
                  style={{
                    width: '28px',
                    height: `${heightPct}%`,
                    borderRadius: '9999px',
                    backgroundColor: isActive ? col.color : col.bgLight,
                    backgroundImage: isActive
                      ? 'none'
                      : `repeating-linear-gradient(45deg, ${col.hatchLight}, ${col.hatchLight} 2px, transparent 2px, transparent 6px)`,
                    border: isActive ? `1.5px solid ${col.color}` : `1.5px solid ${col.color}45`,
                    transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    position: 'relative',
                    boxShadow: isActive ? `0 6px 18px ${col.color}55` : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                  }}
                  title={`${col.label}: ${col.count} inquiries`}
                >
                  {/* Active center dot at the top of the highlighted bar */}
                  {isActive && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        margin: '4px auto 0 auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div
          onMouseLeave={() => setActiveSource(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            bottom: '0px',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          {channels.map((col) => {
            const isActive = col.id === activeSource;
            return (
              <span
                key={col.id}
                onClick={() => setActiveSource((prev) => (prev === col.id ? null : col.id))}
                onMouseEnter={() => setActiveSource(col.id)}
                onMouseLeave={() => setActiveSource(null)}
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#111827' : '#64748B',
                  width: '60px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
              >
                {col.short}
              </span>
            );
          })}
        </div>
      </div>

      {/* Ingestion Sources Legend Grid (Compact, Latency-free) */}
      <div
        onMouseLeave={() => setActiveSource(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(12, 13, 13, 0.05)',
        }}
      >
        {channels.map((col) => {
          const pct = Math.round((col.count / currentTotal) * 100);
          const isActive = col.id === activeSource;
          const Icon = col.icon;
          return (
            <div
              key={col.id}
              onClick={() => setActiveSource((prev) => (prev === col.id ? null : col.id))}
              onMouseEnter={() => setActiveSource(col.id)}
              onMouseLeave={() => setActiveSource(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: '8px',
                backgroundColor: isActive ? '#FFFFFF' : '#F8FAFC',
                border: isActive ? `1.5px solid ${col.color}` : '1px solid rgba(12, 13, 13, 0.06)',
                fontSize: '0.7rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 2px 8px ${col.color}25` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon size={12} color={col.color} />
                <span style={{ fontWeight: 700, color: '#111827' }}>{col.short}</span>
              </div>
              <span style={{ fontWeight: 800, color: isActive ? col.color : '#64748B', fontSize: '0.72rem' }}>
                {col.count} <span style={{ fontSize: '0.62rem', opacity: 0.85 }}>({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 6. CUSTOMER SENTIMENT & CHURN RISK ANALYTICS BAR CHART
// Production-ready telemetry derived from AWS Bedrock single-pass
// sentiment score (-1.0 to +1.0) and proactive churn risk detection (Flow 30).
// Symmetrically complements Ingestion Channels on Row 3.
// ==========================================
interface TasklySentimentBarChartProps {
  inquiries: Inquiry[];
  dragHandle?: React.ReactNode;
  dashboardMetrics?: DashboardMetricsResponse | null;
}

export const TasklySentimentBarChart: React.FC<TasklySentimentBarChartProps> = ({
  inquiries,
  dragHandle,
  dashboardMetrics: _dashboardMetrics,
}) => {
  const [selectedRange, setSelectedRange] = useState<
    'Current Shift' | 'Last 24 Hours' | 'Last 7 Days' | 'Last 8 Weeks'
  >('Current Shift');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeSentiment, setActiveSentiment] = useState<string | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    if (filterOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [filterOpen]);

  // Dynamic dataset counts for each time range option based on real inquiry timestamps:
  const getSentimentCountsForRange = (range: typeof selectedRange) => {
    const cutoffNow = Date.now();
    let filteredInquiries = inquiries;

    if (range === 'Current Shift') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 8 * 3600 * 1000
      );
    } else if (range === 'Last 24 Hours') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 24 * 3600 * 1000
      );
    } else if (range === 'Last 7 Days') {
      filteredInquiries = inquiries.filter(
        (t) => cutoffNow - new Date(t.created_at).getTime() <= 7 * 24 * 3600 * 1000
      );
    }
    if (filteredInquiries.length === 0) {
      filteredInquiries = inquiries;
    }

    return {
      delighted: filteredInquiries.filter((t) => (t.sentiment_score ?? 0) >= 0.6).length,
      satisfied: filteredInquiries.filter(
        (t) => (t.sentiment_score ?? 0) >= 0.15 && (t.sentiment_score ?? 0) < 0.6
      ).length,
      neutral: filteredInquiries.filter(
        (t) => (t.sentiment_score ?? 0) >= -0.15 && (t.sentiment_score ?? 0) < 0.15
      ).length,
      frustrated: filteredInquiries.filter(
        (t) => (t.sentiment_score ?? 0) >= -0.55 && (t.sentiment_score ?? 0) < -0.15 && !t.churn_risk
      ).length,
      churnRisk: filteredInquiries.filter(
        (t) => t.churn_risk === true || (t.sentiment_score ?? 0) < -0.55
      ).length,
    };
  };

  const activeSentimentCounts = getSentimentCountsForRange(selectedRange);

  const sentimentTiers = [
    {
      id: 'delighted',
      label: 'Delighted',
      short: 'Delighted',
      scoreRange: '≥ +0.60',
      count: activeSentimentCounts.delighted,
      color: '#059669',
      bgLight: '#ECFDF5',
      hatchLight: '#A7F3D0',
      icon: Smile,
      description: 'High loyalty score',
    },
    {
      id: 'satisfied',
      label: 'Satisfied',
      short: 'Satisfied',
      scoreRange: '+0.15..+0.60',
      count: activeSentimentCounts.satisfied,
      color: '#10B981',
      bgLight: '#F0FDF4',
      hatchLight: '#BBF7D0',
      icon: Smile,
      description: 'Positive resolution',
    },
    {
      id: 'neutral',
      label: 'Neutral',
      short: 'Neutral',
      scoreRange: '-0.15..+0.15',
      count: activeSentimentCounts.neutral,
      color: '#6366F1',
      bgLight: '#EEF2FF',
      hatchLight: '#C7D2FE',
      icon: Meh,
      description: 'Informational status',
    },
    {
      id: 'frustrated',
      label: 'Frustrated',
      short: 'Frustrated',
      scoreRange: '-0.55..-0.15',
      count: activeSentimentCounts.frustrated,
      color: '#EA580C',
      bgLight: '#FFF7ED',
      hatchLight: '#FED7AA',
      icon: Frown,
      description: 'Resolution delay friction',
    },
    {
      id: 'churn_risk',
      label: 'Churn Risk',
      short: 'Churn Risk',
      scoreRange: '< -0.55 / Flagged',
      count: activeSentimentCounts.churnRisk,
      color: '#DC2626',
      bgLight: '#FEF2F2',
      hatchLight: '#FECACA',
      icon: ShieldAlert,
      description: 'Empathetic defusing priority',
    },
  ];

  const currentTotal = sentimentTiers.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const maxVal = Math.max(...sentimentTiers.map((c) => c.count), 4);
  const activeChurnRiskCount = activeSentimentCounts.churnRisk;
  const activeChurnRatePct = Math.round((activeChurnRiskCount / currentTotal) * 100);

  // Dynamic Y-axis ticks
  const yAxisTicks = [
    maxVal,
    Math.round(maxVal * 0.75),
    Math.round(maxVal * 0.5),
    Math.round(maxVal * 0.25),
    0,
  ];

  return (
    <div
      className="loadlogic-card"
      style={{
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: '260px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={15} color="#DC2626" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.02em', margin: 0 }}>
                Customer Sentiment & Churn Risk
              </h3>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '9999px',
                  backgroundColor: activeChurnRatePct > 15 ? '#FEF2F2' : '#F0FDF4',
                  color: activeChurnRatePct > 15 ? '#DC2626' : '#15803D',
                  border: activeChurnRatePct > 15 ? '1px solid #FECACA' : '1px solid #BBF7D0',
                }}
              >
                {activeChurnRiskCount} At Risk ({activeChurnRatePct}%)
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', color: '#64748B' }}>
              Sentiment score and churn risk analysis
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Dropdown Time Filter */}
          <div style={{ position: 'relative' }} ref={filterDropdownRef}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '9999px',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                fontSize: '0.74rem',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <span>{selectedRange}</span>
              <ChevronDown
                size={12}
                style={{
                  transform: filterOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {filterOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '180px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid rgba(12, 13, 13, 0.1)',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {(['Current Shift', 'Last 24 Hours', 'Last 7 Days', 'Last 8 Weeks'] as const).map(
                  (opt) => (
                    <div
                      key={opt}
                      onClick={() => {
                        setSelectedRange(opt);
                        setFilterOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: selectedRange === opt ? '#ECF4EE' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.74rem',
                        fontWeight: selectedRange === opt ? 800 : 600,
                        color: selectedRange === opt ? '#047857' : '#111827',
                        transition: 'background-color 0.12s ease',
                      }}
                    >
                      <span>{opt}</span>
                      {selectedRange === opt && <Check size={13} color="#047857" />}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {dragHandle}
        </div>
      </div>

      {/* SVG Chart Area with Dotted Guide Lines and Hatched Pill Bars (Compact 110px) */}
      <div style={{ position: 'relative', width: '100%', height: '110px', marginTop: '6px' }}>
        {/* Horizontal Dotted Guide Lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            paddingBottom: '20px',
          }}
        >
          {yAxisTicks.map((val, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <span
                style={{
                  width: '28px',
                  fontSize: '0.64rem',
                  color: '#94A3B8',
                  fontWeight: 600,
                  textAlign: 'right',
                }}
              >
                {val}
              </span>
              <div
                style={{
                  flex: 1,
                  height: '1px',
                  borderTop:
                    i === yAxisTicks.length - 1 ? '1px solid #CBD5E1' : '1px dashed #E2E8F0',
                }}
              />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          onMouseLeave={() => setActiveSentiment(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            top: '6px',
            bottom: '20px',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
          }}
        >
          {sentimentTiers.map((col) => {
            const isActive = col.id === activeSentiment;
            const heightPct = Math.max(14, Math.round((col.count / maxVal) * 85));
            const pct = Math.round((col.count / currentTotal) * 100);
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                onClick={() =>
                  setActiveSentiment((prev) => (prev === col.id ? null : col.id))
                }
                onMouseEnter={() => setActiveSentiment(col.id)}
                onMouseLeave={() => setActiveSentiment(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* Floating Black Tooltip Capsule above active bar */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: `${Math.max(0, 100 - heightPct - 24)}%`,
                      backgroundColor: '#111827',
                      color: '#FFFFFF',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.24)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Icon size={11} color={col.color} />
                    <span>
                      {col.count} Inquiries ({pct}%)
                    </span>
                  </div>
                )}

                {/* Hatched Pill Bar with Unique Colors (Compact Width) */}
                <div
                  style={{
                    width: '26px',
                    height: `${heightPct}%`,
                    borderRadius: '9999px',
                    backgroundColor: isActive ? col.color : col.bgLight,
                    backgroundImage: isActive
                      ? 'none'
                      : `repeating-linear-gradient(45deg, ${col.hatchLight}, ${col.hatchLight} 2px, transparent 2px, transparent 6px)`,
                    border: isActive ? `1.5px solid ${col.color}` : `1.5px solid ${col.color}45`,
                    transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    position: 'relative',
                    boxShadow: isActive ? `0 6px 18px ${col.color}55` : 'none',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                  }}
                  title={`${col.label} (${col.scoreRange}): ${col.count} inquiries`}
                >
                  {/* Active center dot at the top of the highlighted bar */}
                  {isActive && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#FFFFFF',
                        margin: '4px auto 0 auto',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* X-Axis Labels */}
        <div
          onMouseLeave={() => setActiveSentiment(null)}
          style={{
            position: 'absolute',
            left: '42px',
            right: '12px',
            bottom: '0px',
            display: 'flex',
            justifyContent: 'space-around',
          }}
        >
          {sentimentTiers.map((col) => {
            const isActive = col.id === activeSentiment;
            return (
              <span
                key={col.id}
                onClick={() =>
                  setActiveSentiment((prev) => (prev === col.id ? null : col.id))
                }
                onMouseEnter={() => setActiveSentiment(col.id)}
                onMouseLeave={() => setActiveSentiment(null)}
                style={{
                  fontSize: '0.66rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#111827' : '#64748B',
                  width: '54px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.short}
              </span>
            );
          })}
        </div>
      </div>

      {/* Sentiment Tiers Legend Grid */}
      <div
        onMouseLeave={() => setActiveSentiment(null)}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '6px',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(12, 13, 13, 0.05)',
        }}
      >
        {sentimentTiers.map((col) => {
          const pct = Math.round((col.count / currentTotal) * 100);
          const isActive = col.id === activeSentiment;
          const Icon = col.icon;
          return (
            <div
              key={col.id}
              onClick={() =>
                setActiveSentiment((prev) => (prev === col.id ? null : col.id))
              }
              onMouseEnter={() => setActiveSentiment(col.id)}
              onMouseLeave={() => setActiveSentiment(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                borderRadius: '8px',
                backgroundColor: isActive ? '#FFFFFF' : '#F8FAFC',
                border: isActive ? `1.5px solid ${col.color}` : '1px solid rgba(12, 13, 13, 0.06)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? `0 2px 8px ${col.color}25` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                <Icon size={11} color={col.color} style={{ flexShrink: 0 }} />
                <span
                  style={{
                    fontWeight: 700,
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '0.65rem',
                  }}
                >
                  {col.short}
                </span>
              </div>
              <span
                style={{
                  fontWeight: 800,
                  color: isActive ? col.color : '#64748B',
                  fontSize: '0.68rem',
                  flexShrink: 0,
                  marginLeft: '2px',
                }}
              >
                {col.count} <span style={{ fontSize: '0.58rem', opacity: 0.85 }}>({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
