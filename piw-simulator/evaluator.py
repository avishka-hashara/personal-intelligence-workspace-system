import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

# 1. Define Antecedents (Inputs) & Consequent (Output)
task_load = ctrl.Antecedent(np.arange(0, 14.1, 0.1), 'task_load')
sleep_deficit = ctrl.Antecedent(np.arange(0, 4.1, 0.1), 'sleep_deficit')
habit_adherence = ctrl.Antecedent(np.arange(0, 100.1, 0.5), 'habit_adherence')
burnout_risk = ctrl.Consequent(np.arange(0, 100.1, 0.5), 'burnout_risk')

# 2. Membership functions
task_load.automf(3, names=['low', 'average', 'high'])
sleep_deficit.automf(3, names=['low', 'average', 'high'])
habit_adherence.automf(3, names=['low', 'average', 'high'])

# Custom triangular membership functions for burnout_risk output
burnout_risk['low'] = fuzz.trimf(burnout_risk.universe, [0, 0, 30])
burnout_risk['medium'] = fuzz.trimf(burnout_risk.universe, [20, 50, 70])
burnout_risk['high'] = fuzz.trimf(burnout_risk.universe, [60, 80, 90])
burnout_risk['critical'] = fuzz.trimf(burnout_risk.universe, [80, 100, 100])

# 3. Construct Expert Rules
rule1 = ctrl.Rule(task_load['high'] & sleep_deficit['high'], burnout_risk['critical'])
rule2 = ctrl.Rule(habit_adherence['high'] & task_load['average'], burnout_risk['low'])
rule3 = ctrl.Rule(task_load['high'] & habit_adherence['low'], burnout_risk['high'])
rule4 = ctrl.Rule(sleep_deficit['high'] & habit_adherence['low'], burnout_risk['critical'])
rule5 = ctrl.Rule(task_load['low'] & sleep_deficit['low'], burnout_risk['low'])
rule6 = ctrl.Rule(sleep_deficit['average'] & task_load['average'], burnout_risk['medium'])
rule7 = ctrl.Rule(task_load['high'] & sleep_deficit['average'], burnout_risk['high'])

# 4. Build Control System
risk_ctrl = ctrl.ControlSystem([rule1, rule2, rule3, rule4, rule5, rule6, rule7])


def calculate_daily_risk(load: float, deficit: float, adherence: float) -> float:
    """
    Calculates the predicted daily burnout risk score (0-100%) using fuzzy logic.

    :param load: Daily task load in hours (0 to 14)
    :param deficit: Sleep deficit hours below baseline (0 to 4)
    :param adherence: Habit adherence rate percentage (0 to 100)
    :return: Burnout risk score (0 to 100)
    """
    # Clamp input values to supported bounds
    load_val = float(np.clip(load, 0.0, 14.0))
    deficit_val = float(np.clip(deficit, 0.0, 4.0))
    adherence_val = float(np.clip(adherence, 0.0, 100.0))

    simulation = ctrl.ControlSystemSimulation(risk_ctrl)
    simulation.input['task_load'] = load_val
    simulation.input['sleep_deficit'] = deficit_val
    simulation.input['habit_adherence'] = adherence_val

    try:
        simulation.compute()
        risk_score = float(simulation.output['burnout_risk'])
    except Exception:
        # Fallback linear approximation if fuzzy defuzzification fails at extreme boundary crisp values
        base_risk = (load_val / 14.0) * 50.0 + (deficit_val / 4.0) * 35.0 + ((100.0 - adherence_val) / 100.0) * 15.0
        risk_score = float(np.clip(base_risk, 0.0, 100.0))

    return round(risk_score, 2)
