import React, { useState } from 'react';
import { X, RotateCcw, AlertCircle } from 'lucide-react';
import {
  DepartmentEnum,
  PriorityEnum,
} from '../types/inquiry';
import type { Inquiry } from '../types/inquiry';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Inquiry | null;
  onSubmitOverride: (
    inquiryId: string,
    newDepartment: DepartmentEnum,
    newPriority: PriorityEnum,
    reason: string
  ) => void;
  isSubmitting: boolean;
}

export const OverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onSubmitOverride,
  isSubmitting,
}) => {
  if (!isOpen || !ticket) return null;

  const [selectedDept, setSelectedDept] = useState<DepartmentEnum>(ticket.department);
  const [selectedPriority, setSelectedPriority] = useState<PriorityEnum>(ticket.priority);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setError('A mandatory engineering justification of at least 10 characters is required for compliance and MLOps tracking.');
      return;
    }
    setError(null);
    onSubmitOverride(ticket.id, selectedDept, selectedPriority, reason.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(12, 13, 13, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
              }}
            >
              <RotateCcw size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-black)', margin: 0, letterSpacing: '-0.02em' }}>
                Override AI Classification
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                MLOps calibration with immutable audit ledger justification
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '6px',
              borderRadius: '50%',
              border: '1px solid rgba(12, 13, 13, 0.1)',
              backgroundColor: '#FAFAFA',
              color: 'var(--color-black)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                fontSize: '0.76rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Ticket Target Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: '#FAFAFA',
              border: '1px solid rgba(12, 13, 13, 0.08)',
              fontSize: '0.78rem',
              color: '#0C0D0D',
            }}
          >
            Overriding Ticket: <strong style={{ fontFamily: 'var(--font-mono)' }}>#{ticket.id.slice(0, 8).toUpperCase()}</strong> - {ticket.subject}
          </div>

          {/* Department & Priority Select Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                New Department
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as DepartmentEnum)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#FAFAFA',
                  border: '1px solid rgba(12, 13, 13, 0.12)',
                  color: '#0C0D0D',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              >
                <option value={DepartmentEnum.TECH_SUPPORT}>Tech Support</option>
                <option value={DepartmentEnum.BILLING}>Billing</option>
                <option value={DepartmentEnum.SECURITY}>Security</option>
                <option value={DepartmentEnum.ACCOUNTS}>Accounts</option>
                <option value={DepartmentEnum.SALES}>Sales</option>
                <option value={DepartmentEnum.GENERAL}>General</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                New Priority
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as PriorityEnum)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: '#FAFAFA',
                  border: '1px solid rgba(12, 13, 13, 0.12)',
                  color: '#0C0D0D',
                  fontSize: '0.82rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                }}
              >
                <option value={PriorityEnum.P1}>P1 - Emergency (1h SLA)</option>
                <option value={PriorityEnum.P2}>P2 - High (4h SLA)</option>
                <option value={PriorityEnum.P3}>P3 - Medium (8h SLA)</option>
                <option value={PriorityEnum.P4}>P4 - Low (24h SLA)</option>
              </select>
            </div>
          </div>

          {/* Justification Reason Textarea */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mandatory Engineering Justification (min 10 chars)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Model mistook payment dispute for general technical support; routing to Senior Billing team."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                backgroundColor: '#FAFAFA',
                border: '1px solid rgba(12, 13, 13, 0.12)',
                color: '#0C0D0D',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                border: '1px solid rgba(12, 13, 13, 0.15)',
                backgroundColor: '#FFFFFF',
                color: '#0C0D0D',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 20px',
                borderRadius: '9999px',
                backgroundColor: '#0C0D0D',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(12, 13, 13, 0.15)',
              }}
            >
              <span>{isSubmitting ? 'Recording...' : 'Commit MLOps Override'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
