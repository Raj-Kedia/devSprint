from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    change_type = Column(String(50), nullable=False)  # status_change, assignee_change, comment, created, etc.
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    message = Column(Text, nullable=True)  # Optional descriptive context or comment text
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    # Relationships
    task = relationship("Task", back_populates="activities")
    user = relationship("User", back_populates="activities")
