from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "PIW Predictive Life Simulator Engine" in data["service"]
    print("Health check endpoint test passed!")

def test_simulate_timeline_endpoint():
    payload = {
        "tasks": [
            {"title": "Complete Next.js Integration", "estimated_hours": 12.0, "due_date": "2026-09-22"},
            {"title": "Prepare ML Engine Docs", "estimated_hours": 8.0, "due_date": "2026-09-25"},
            {"title": "Refactor Database Schemas", "estimated_hours": 15.0}
        ],
        "habits": [
            {"name": "Morning Workout", "adherence_rate": 80.0},
            {"name": "Daily Journaling", "adherence_rate": 65.0}
        ],
        "health_metrics": {
            "sleep_hours": 6.0,
            "sleep_baseline": 8.0,
            "stress_level": 6.5
        }
    }

    response = client.post("/simulate/timeline", json=payload)
    assert response.status_code == 200, f"Error: {response.text}"

    data = response.json()
    assert "predicted_bottleneck_dates" in data
    assert "risk_scores" in data
    assert "alternate_schedule_recommendations" in data

    assert len(data["risk_scores"]) == 30
    assert len(data["alternate_schedule_recommendations"]) > 0

    first_day = data["risk_scores"][0]
    assert "date" in first_day
    assert "task_load" in first_day
    assert "burnout_risk" in first_day
    assert "risk_level" in first_day

    print(f"Simulation completed successfully!")
    print(f"Sample 30-day timeline first day: {first_day}")
    print(f"Predicted bottleneck dates count: {len(data['predicted_bottleneck_dates'])}")
    print(f"Recommendations: {data['alternate_schedule_recommendations']}")

if __name__ == "__main__":
    test_root_endpoint()
    test_simulate_timeline_endpoint()
