from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class StandupReport(Base):
    __tablename__ = "standup_reports"

    id = Column(Integer, primary_key=True, index=True)
    sprint_id = Column(Integer, ForeignKey("sprints.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    report_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), nullable=False, index=True)
    summary = Column(Text, nullable=False)
    yesterday = Column(Text, nullable=True)
    today = Column(Text, nullable=True)
    blockers = Column(Text, nullable=True)
    raw_ai_response = Column(Text, nullable=True)
    model_used = Column(String(50), default="DevSprint-AI-Synthesizer")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    sprint = relationship("Sprint", back_populates="standup_reports")
    user = relationship("User", back_populates="standup_reports")
