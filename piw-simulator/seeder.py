import math
import random
from datetime import date, timedelta
from typing import Dict, Any, List

from evaluator import calculate_daily_risk
from models import CurrentState, TaskItem, HabitItem, HealthMetrics


def generate_historical_data(days: int = 90) -> Dict[str, Any]:
    """
    Generates a realistic synthetic time-series history for N past days (30 to 365).
    Models human behavioral dynamics including sprint crunches, weekend slowdowns,
    sleep debt accumulation, and habit adherence fluctuations.
    """
    days = max(7, min(days, 365))
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    timeline_logs: List[Dict[str, Any]] = []
    
    total_risk = 0.0
    critical_count = 0
    high_risk_count = 0
    total_sleep = 0.0
    total_load = 0.0
    total_adherence = 0.0

    for i in range(days):
        current_date = start_date + timedelta(days=i)
        day_str = current_date.isoformat()
        day_of_week = current_date.weekday()  # 0=Mon, 6=Sun

        # 1. Simulate Sprint & Workload Cycles
        # Every 21 days, simulate a 4-day "crunch sprint"
        sprint_phase = (i % 21)
        is_crunch = 14 <= sprint_phase <= 17

        if is_crunch:
            base_task_load = 10.5 + (i % 3) * 1.0  # 10.5 to 12.5 hrs
            base_sleep = 5.0 + (i % 2) * 0.5        # 5.0 to 5.5 hrs
            base_adherence = 40.0 + (i % 4) * 5.0   # 40-55%
            stress_level = 8.0 + (i % 3) * 0.5
        elif day_of_week in (5, 6):  # Weekend
            base_task_load = 2.0 + (i % 3) * 0.5   # 2.0 to 3.0 hrs
            base_sleep = 8.0 + (i % 3) * 0.5        # 8.0 to 9.0 hrs
            base_adherence = 85.0 + (i % 3) * 4.0   # 85-93%
            stress_level = 3.0 + (i % 2) * 0.5
        else:  # Normal weekday
            base_task_load = 6.5 + (i % 5) * 0.7   # 6.5 to 9.3 hrs
            base_sleep = 6.8 + (i % 4) * 0.3        # 6.8 to 7.7 hrs
            base_adherence = 70.0 + (i % 5) * 4.0   # 70-86%
            stress_level = 5.0 + (i % 4) * 0.6

        # Add pseudo-random variations
        variation = math.sin(i * 0.3) * 0.8
        task_load = round(max(0.5, min(14.0, base_task_load + variation)), 2)
        sleep_hours = round(max(4.0, min(10.0, base_sleep - variation * 0.3)), 2)
        sleep_baseline = 8.0
        sleep_deficit = round(max(0.0, sleep_baseline - sleep_hours), 2)
        adherence_rate = round(max(10.0, min(100.0, base_adherence + variation * 3.0)), 1)
        stress = round(max(1.0, min(10.0, stress_level + variation * 0.4)), 1)

        # 2. Compute Burnout Risk via Fuzzy Evaluator
        risk_score = calculate_daily_risk(
            load=task_load,
            deficit=sleep_deficit,
            adherence=adherence_rate
        )

        if risk_score >= 75.0:
            risk_level = "critical"
            critical_count += 1
        elif risk_score >= 60.0:
            risk_level = "high"
            high_risk_count += 1
        elif risk_score >= 35.0:
            risk_level = "medium"
        else:
            risk_level = "low"

        timeline_logs.append({
            "date": day_str,
            "task_load_hours": task_load,
            "sleep_hours": sleep_hours,
            "sleep_deficit_hours": sleep_deficit,
            "habit_adherence_percent": adherence_rate,
            "stress_level": stress,
            "burnout_risk_score": risk_score,
            "risk_level": risk_level,
            "is_crunch_period": is_crunch
        })

        total_risk += risk_score
        total_sleep += sleep_hours
        total_load += task_load
        total_adherence += adherence_rate

    avg_risk = round(total_risk / days, 2)
    avg_sleep = round(total_sleep / days, 2)
    avg_load = round(total_load / days, 2)
    avg_adherence = round(total_adherence / days, 1)

    return {
        "timeframe": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "total_days": days
        },
        "summary_statistics": {
            "average_burnout_risk": avg_risk,
            "average_daily_task_load_hours": avg_load,
            "average_daily_sleep_hours": avg_sleep,
            "average_habit_adherence_percent": avg_adherence,
            "critical_risk_days": critical_count,
            "high_risk_days": high_risk_count,
            "total_bottleneck_days": critical_count + high_risk_count
        },
        "daily_logs": timeline_logs
    }


def generate_seeded_current_state() -> CurrentState:
    """
    Returns a rich, realistic CurrentState payload populated with active tasks,
    habits, and health metrics suitable for simulation testing.
    """
    today = date.today()

    tasks = [
        TaskItem(
            title="Database Migration & Schema Sync",
            estimated_hours=6.5,
            due_date=(today + timedelta(days=2)).isoformat()
        ),
        TaskItem(
            title="Implement Redis Caching Layer",
            estimated_hours=4.0,
            due_date=(today + timedelta(days=3)).isoformat()
        ),
        TaskItem(
            title="Design Dashboard Analytics Wireframes",
            estimated_hours=8.0,
            due_date=(today + timedelta(days=5)).isoformat()
        ),
        TaskItem(
            title="Refactor JWT Auth & Refresh Tokens",
            estimated_hours=5.5,
            due_date=(today + timedelta(days=7)).isoformat()
        ),
        TaskItem(
            title="Write End-to-End Cypress Integration Tests",
            estimated_hours=7.0,
            due_date=(today + timedelta(days=10)).isoformat()
        ),
        TaskItem(
            title="Conduct User Experience Feedback Interviews",
            estimated_hours=3.5,
            due_date=(today + timedelta(days=12)).isoformat()
        ),
        TaskItem(
            title="Optimize Bundle Size & Image Assets",
            estimated_hours=4.5,
            due_date=(today + timedelta(days=15)).isoformat()
        )
    ]

    habits = [
        HabitItem(name="Morning Running / Fitness", adherence_rate=85.0),
        HabitItem(name="Daily Tech Reading (30 mins)", adherence_rate=70.0),
        HabitItem(name="Hydration Goal (2.5 Liters)", adherence_rate=90.0),
        HabitItem(name="Code Review & Clean Up", adherence_rate=60.0),
        HabitItem(name="Evening Mindfulness Meditation", adherence_rate=50.0)
    ]

    health_metrics = HealthMetrics(
        sleep_hours=6.2,
        sleep_baseline=8.0,
        stress_level=6.2
    )

    return CurrentState(
        tasks=tasks,
        habits=habits,
        health_metrics=health_metrics
    )
