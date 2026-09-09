import React, { useState } from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
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
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="#f87171" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#fca5a5' }}>
              Override AI Classification (MLOps Calibration)
            </span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.3rem', borderRadius: '50%' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Ticket #{ticket.id.substring(0, 8)}: <strong>{ticket.subject}</strong>
          </div>

          {/* Department Select */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
              NEW DEPARTMENT TAXONOMY:
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value as DepartmentEnum)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            >
              {Object.values(DepartmentEnum).map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Select */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
              NEW ITIL PRIORITY / SLA:
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as PriorityEnum)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            >
              {Object.values(PriorityEnum).map((p) => (
                <option key={p} value={p}>
                  {p} {p === 'P1' ? '(30m Critical)' : p === 'P2' ? '(2h High)' : p === 'P3' ? '(8h Normal)' : '(24h Low)'}
                </option>
              ))}
            </select>
          </div>

          {/* Mandatory Justification */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '0.3rem' }}>
              MANDATORY ENGINEERING JUSTIFICATION (Min 10 characters):
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Explain why the AI classification was adjusted (e.g., Hidden IDOR vulnerability misclassified as standard API bug)..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '6px',
                background: 'var(--bg-input)',
                border: error ? '1px solid #ef4444' : '1px solid var(--border-prominent)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                resize: 'none',
              }}
            />
            {error && (
              <span style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.2rem', display: 'block' }}>
                {error}
              </span>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 10}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem' }}
            >
              <Check size={14} />
              <span>Confirm Calibration & Recalculate SLA</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
