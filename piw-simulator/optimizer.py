import random
import numpy as np
from datetime import date, timedelta
from typing import List, Dict, Any, Tuple

from deap import base, creator, tools, algorithms
from evaluator import calculate_daily_risk

# 1. Initialize DEAP Fitness Minimization & Individual Classes
if not hasattr(creator, "FitnessMin"):
    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
if not hasattr(creator, "Individual"):
    creator.create("Individual", list, fitness=creator.FitnessMin)


def evaluate_schedule(
    individual: List[int],
    tasks: List[Dict[str, Any]],
    base_deficit: float,
    base_adherence: float
) -> Tuple[float]:
    """
    Evaluation function for DEAP Genetic Algorithm.
    Calculates the 30-day peak burnout risk for a candidate schedule individual.
    Applies a heavy fitness penalty if tasks are scheduled past their hard due dates.
    """
    start_date = date.today()
    daily_loads = [0.0] * 30

    # 1. Map tasks to days based on individual day offsets
    penalty = 0.0

    for idx, day_offset in enumerate(individual):
        task = tasks[idx]
        task_hours = task.get("estimated_hours", 1.5)
        clamped_offset = max(0, min(29, day_offset))
        
        daily_loads[clamped_offset] += task_hours

        # Enforce Hard Deadline Penalty
        due_date_str = task.get("due_date")
        if due_date_str:
            try:
                due_d = date.fromisoformat(due_date_str)
                assigned_d = start_date + timedelta(days=clamped_offset)
                if assigned_d > due_d:
                    overdue_days = (assigned_d - due_d).days
                    penalty += 50.0 + (overdue_days * 25.0)
            except Exception:
                pass

    # 2. Compute daily burnout risk across 30-day forward window
    max_risk = 0.0

    for day_offset in range(30):
        current_day = start_date + timedelta(days=day_offset)
        scheduled_hours = daily_loads[day_offset]

        # Weekend factor
        if current_day.weekday() in (5, 6):
            weekend_factor = 0.5
        else:
            weekend_factor = 1.0

        daily_task_load = (scheduled_hours + 3.0) * weekend_factor
        daily_task_load = min(daily_task_load, 14.0)

        risk = calculate_daily_risk(
            load=daily_task_load,
            deficit=base_deficit,
            adherence=base_adherence
        )

        if risk > max_risk:
            max_risk = risk

    # Total fitness score = peak burnout risk + penalty
    total_fitness = max_risk + penalty
    return (total_fitness,)


def optimize_schedule(
    tasks: List[Dict[str, Any]],
    base_deficit: float = 1.5,
    base_adherence: float = 75.0
) -> Dict[str, Any]:
    """
    Executes an Evolutionary Genetic Algorithm using DEAP to optimize task schedule dates,
    minimizing peak burnout risk while respecting due dates.
    """
    if not tasks:
        return {
            "before_peak_risk": 0.0,
            "after_peak_risk": 0.0,
            "optimized_risk_scores": [],
            "task_updates": []
        }

    start_date = date.today()
    num_tasks = len(tasks)

    # 1. Build initial baseline individual (mapping current task due dates or default day 0)
    baseline_ind = []
    for t in tasks:
        due_str = t.get("due_date")
        if due_str:
            try:
                due_d = date.fromisoformat(due_str)
                offset = max(0, min(29, (due_d - start_date).days))
                baseline_ind.append(offset)
            except Exception:
                baseline_ind.append(0)
        else:
            baseline_ind.append(random.randint(0, 14))

    # Evaluate original baseline peak risk
    before_peak_risk = round(evaluate_schedule(baseline_ind, tasks, base_deficit, base_adherence)[0], 2)

    # 2. Register DEAP Toolbox Functions
    toolbox = base.Toolbox()
    toolbox.register("attr_day", random.randint, 0, 29)
    toolbox.register("individual", tools.initRepeat, creator.Individual, toolbox.attr_day, n=num_tasks)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    
    toolbox.register(
        "evaluate",
        evaluate_schedule,
        tasks=tasks,
        base_deficit=base_deficit,
        base_adherence=base_adherence
    )
    
    toolbox.register("mate", tools.cxTwoPoint)
    toolbox.register("mutate", tools.mutUniformInt, low=0, up=29, indpb=0.2)
    toolbox.register("select", tools.selTournament, tournsize=3)

    # 3. Create Population & Run EA Simple
    pop = toolbox.population(n=50)
    # Include baseline individual in initial population
    pop[0] = creator.Individual(baseline_ind)

    # Run Evolutionary Algorithm for 50 generations
    algorithms.eaSimple(pop, toolbox, cxpb=0.7, mutpb=0.2, ngen=50, verbose=False)

    # 4. Extract Best Individual
    best_ind = tools.selBest(pop, 1)[0]
    after_peak_risk = round(evaluate_schedule(best_ind, tasks, base_deficit, base_adherence)[0], 2)

    # Ensure after_peak_risk doesn't report higher than original baseline
    if after_peak_risk > before_peak_risk:
        best_ind = baseline_ind
        after_peak_risk = before_peak_risk

    # 5. Build Optimized Schedule Results
    task_updates = []
    daily_loads = [0.0] * 30

    for idx, day_offset in enumerate(best_ind):
        clamped_offset = max(0, min(29, day_offset))
        t = tasks[idx]
        task_hours = t.get("estimated_hours", 1.5)
        daily_loads[clamped_offset] += task_hours

        opt_date = start_date + timedelta(days=clamped_offset)
        task_updates.append({
            "id": t.get("id"),
            "title": t.get("title", "Untitled Task"),
            "original_due_date": t.get("due_date"),
            "optimized_due_date": opt_date.isoformat(),
            "assigned_day_offset": clamped_offset
        })

    # Build 30-day optimized risk timeline
    optimized_risk_timeline = []

    for day_offset in range(30):
        current_day = start_date + timedelta(days=day_offset)
        day_str = current_day.isoformat()
        scheduled_hours = daily_loads[day_offset]

        weekend_factor = 0.5 if current_day.weekday() in (5, 6) else 1.0
        daily_task_load = min(14.0, round((scheduled_hours + 3.0) * weekend_factor, 2))

        risk = calculate_daily_risk(
            load=daily_task_load,
            deficit=base_deficit,
            adherence=base_adherence
        )

        optimized_risk_timeline.append({
            "date": day_str,
            "task_load": daily_task_load,
            "burnout_risk": risk,
            "risk_level": "critical" if risk >= 75 else "high" if risk >= 60 else "medium" if risk >= 35 else "low"
        })

    return {
        "before_peak_risk": before_peak_risk,
        "after_peak_risk": after_peak_risk,
        "risk_reduction_percent": round(max(0.0, before_peak_risk - after_peak_risk), 2),
        "optimized_risk_timeline": optimized_risk_timeline,
        "task_updates": task_updates
    }
