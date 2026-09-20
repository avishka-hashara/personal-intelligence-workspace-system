from datetime import date, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from evaluator import calculate_daily_risk
from models import (
    TaskItem,
    HabitItem,
    HealthMetrics,
    CurrentState,
    DailyRiskScore,
    SimulationResult
)
from seeder import generate_historical_data, generate_seeded_current_state
from optimizer import optimize_schedule

app = FastAPI(
    title="PIW Predictive Life Simulator Engine",
    description="Fuzzy logic risk evaluator, timeline predictor, and genetic algorithm optimizer sidecar service.",
    version="1.0.0"
)


# ==========================================
# Optimization Data Models
# ==========================================

class TaskOptimizationUpdate(BaseModel):
    id: Optional[str] = None
    title: str
    original_due_date: Optional[str] = None
    optimized_due_date: str
    assigned_day_offset: int


class OptimizedScheduleResult(BaseModel):
    before_peak_risk: float
    after_peak_risk: float
    risk_reduction_percent: float
    optimized_risk_timeline: List[DailyRiskScore]
    task_updates: List[TaskOptimizationUpdate]


# ==========================================
# Endpoints
# ==========================================

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "PIW Predictive Life Simulator Engine",
        "version": "1.0.0"
    }


@app.get("/simulate/mock-state", response_model=CurrentState)
def get_mock_state():
    """
    Returns a rich, multi-month realistic CurrentState payload for testing.
    """
    return generate_seeded_current_state()


@app.get("/simulate/seed-data")
def get_seed_data(days: int = Query(90, ge=7, le=365, description="Number of past historical days to generate")):
    """
    Generates synthetic historical time-series data for N past days (tasks, habits, sleep, burnout risk).
    """
    return generate_historical_data(days=days)


@app.post("/simulate/timeline", response_model=SimulationResult)
def simulate_timeline(state: CurrentState):
    """
    Evaluates a 30-day forward timeline based on the current state payload.
    Uses fuzzy logic rules to estimate daily burnout risk scores and highlight bottlenecks.
    """
    start_date = date.today()
    daily_risk_timeline: List[DailyRiskScore] = []
    bottleneck_dates: List[str] = []

    # Calculate average habit adherence
    if state.habits:
        avg_adherence = sum(h.adherence_rate for h in state.habits) / len(state.habits)
    else:
        avg_adherence = 75.0  # Default baseline if no habits supplied

    # Calculate sleep deficit from health metrics
    sleep_deficit = state.health_metrics.sleep_deficit

    # Map upcoming tasks by due date or calculate total task load
    tasks_by_date = {}
    unscheduled_total_hours = 0.0

    for t in state.tasks:
        if t.due_date:
            tasks_by_date[t.due_date] = tasks_by_date.get(t.due_date, 0.0) + t.estimated_hours
        else:
            unscheduled_total_hours += t.estimated_hours

    # Distribute unscheduled tasks across the 30-day window
    base_unscheduled_daily = unscheduled_total_hours / 30.0

    # Mock 30-day forward window evaluation
    for day_offset in range(30):
        current_day = start_date + timedelta(days=day_offset)
        day_str = current_day.isoformat()

        # Combine scheduled task load for this specific date + baseline load
        scheduled_hours = tasks_by_date.get(day_str, 0.0)

        # Add simulated workload variation for weekends / mid-week spikes
        day_of_week = current_day.weekday()
        if day_of_week in (5, 6):  # Saturday/Sunday
            weekend_factor = 0.5
        else:
            weekend_factor = 1.0

        daily_task_load = (scheduled_hours + base_unscheduled_daily + 4.0) * weekend_factor
        daily_task_load = round(min(daily_task_load, 14.0), 2)

        # Compute risk using fuzzy logic evaluator
        risk = calculate_daily_risk(
            load=daily_task_load,
            deficit=sleep_deficit,
            adherence=avg_adherence
        )

        # Determine qualitative risk level
        if risk >= 75.0:
            risk_level = "critical"
            bottleneck_dates.append(day_str)
        elif risk >= 60.0:
            risk_level = "high"
            if day_str not in bottleneck_dates:
                bottleneck_dates.append(day_str)
        elif risk >= 35.0:
            risk_level = "medium"
        else:
            risk_level = "low"

        daily_risk_timeline.append(
            DailyRiskScore(
                date=day_str,
                task_load=daily_task_load,
                burnout_risk=risk,
                risk_level=risk_level
            )
        )

    # Generate alternate schedule recommendations based on simulation results
    recommendations: List[str] = []

    if bottleneck_dates:
        recommendations.append(
            f"Detected {len(bottleneck_dates)} potential bottleneck day(s) starting around {bottleneck_dates[0]}. Consider redistributing peak task loads."
        )

    if sleep_deficit > 1.0:
        recommendations.append(
            f"Sleep deficit is currently {sleep_deficit:.1f} hour(s). Increasing sleep duration by 1 hour can reduce burnout risk by up to 25%."
        )

    if avg_adherence < 60.0:
        recommendations.append(
            "Habit adherence is below target (60%). Stabilizing routine habits will build burnout resilience."
        )

    if not recommendations:
        recommendations.append(
            "Schedule and schedule metrics are well balanced. High probability of goal completion with minimal burnout risk."
        )

    return SimulationResult(
        predicted_bottleneck_dates=bottleneck_dates,
        risk_scores=daily_risk_timeline,
        alternate_schedule_recommendations=recommendations
    )


@app.post("/simulate/optimize", response_model=OptimizedScheduleResult)
def optimize_timeline(state: CurrentState):
    """
    Uses an Evolutionary Genetic Algorithm (DEAP) to optimize task assignment dates,
    flattening peak burnout risk across the 30-day timeline.
    """
    if state.habits:
        avg_adherence = sum(h.adherence_rate for h in state.habits) / len(state.habits)
    else:
        avg_adherence = 75.0

    sleep_deficit = state.health_metrics.sleep_deficit

    # Format task dictionaries for optimizer
    taskList = []
    for t in state.tasks:
        taskList.append({
            "id": t.id or t.title,
            "title": t.title,
            "estimated_hours": t.estimated_hours,
            "due_date": t.due_date
        })

    result = optimize_schedule(
        tasks=taskList,
        base_deficit=sleep_deficit,
        base_adherence=avg_adherence
    )

    return OptimizedScheduleResult(
        before_peak_risk=result["before_peak_risk"],
        after_peak_risk=result["after_peak_risk"],
        risk_reduction_percent=result["risk_reduction_percent"],
        optimized_risk_timeline=result["optimized_risk_timeline"],
        task_updates=result["task_updates"]
    )
