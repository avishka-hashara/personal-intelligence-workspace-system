from typing import List, Optional
from pydantic import BaseModel, Field


class TaskItem(BaseModel):
    id: Optional[str] = Field(None, description="Task ID (UUID)")
    title: str = Field(..., description="Title of the task")
    estimated_hours: float = Field(..., ge=0, description="Estimated effort in hours")
    due_date: Optional[str] = Field(None, description="Due date in YYYY-MM-DD format")


class HabitItem(BaseModel):
    name: str = Field(..., description="Habit name")
    adherence_rate: float = Field(..., ge=0, le=100, description="Current adherence rate (0-100%)")


class HealthMetrics(BaseModel):
    sleep_hours: float = Field(7.0, ge=0, le=24, description="Average daily sleep hours")
    sleep_baseline: float = Field(8.0, ge=0, le=24, description="Baseline required sleep hours")
    stress_level: float = Field(5.0, ge=0, le=10, description="Self-reported stress score (0-10)")

    @property
    def sleep_deficit(self) -> float:
        return max(0.0, self.sleep_baseline - self.sleep_hours)


class CurrentState(BaseModel):
    tasks: List[TaskItem] = Field(default_factory=list, description="Upcoming tasks")
    habits: List[HabitItem] = Field(default_factory=list, description="Active habits")
    health_metrics: HealthMetrics = Field(default_factory=HealthMetrics, description="Recent health metrics")


class DailyRiskScore(BaseModel):
    date: str
    task_load: float
    burnout_risk: float
    risk_level: str


class SimulationResult(BaseModel):
    predicted_bottleneck_dates: List[str] = Field(..., description="Dates predicted to exceed burnout threshold")
    risk_scores: List[DailyRiskScore] = Field(..., description="30-day timeline daily risk scores")
    alternate_schedule_recommendations: List[str] = Field(..., description="Recommendations for schedule optimization")
