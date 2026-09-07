"""SQLAlchemy ORM models package."""
from app.models.inquiry import Inquiry, AuditLog

__all__ = ["Inquiry", "AuditLog"]
