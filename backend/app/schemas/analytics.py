from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class BurndownPoint(BaseModel):
    date: str
    label: str
    ideal_points: float
    actual_points: int
    completed_points: int


class MemberWorkload(BaseModel):
    user_id: Optional[int]
    name: str
    total_tasks: int
    completed_tasks: int
    story_points: int


class SprintAnalyticsOut(BaseModel):
    sprint_id: int
    sprint_name: str
    start_date: str
    end_date: str
    total_tasks: int
    total_points: int
    completed_points: int
    remaining_points: int
    completion_rate_percent: float
    burndown: List[BurndownPoint]
    status_distribution: Dict[str, int]
    priority_distribution: Dict[str, int]
    member_workload: List[MemberWorkload]
