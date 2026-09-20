from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_optimize_endpoint():
    payload = {
        "tasks": [
            {"title": "Database Schema Migration", "estimated_hours": 8.0, "due_date": "2026-09-22"},
            {"title": "Implement Redis Caching Layer", "estimated_hours": 6.0, "due_date": "2026-09-22"},
            {"title": "Design Dashboard Analytics", "estimated_hours": 10.0, "due_date": "2026-09-25"},
            {"title": "Write Cypress Integration Tests", "estimated_hours": 5.0, "due_date": "2026-09-28"}
        ],
        "habits": [
            {"name": "Morning Running", "adherence_rate": 80.0},
            {"name": "Tech Reading", "adherence_rate": 65.0}
        ],
        "health_metrics": {
            "sleep_hours": 6.0,
            "sleep_baseline": 8.0,
            "stress_level": 6.5
        }
    }

    response = client.post("/simulate/optimize", json=payload)
    assert response.status_code == 200, f"Error: {response.text}"

    data = response.json()
    assert "before_peak_risk" in data
    assert "after_peak_risk" in data
    assert "risk_reduction_percent" in data
    assert "optimized_risk_timeline" in data
    assert "task_updates" in data

    assert len(data["optimized_risk_timeline"]) == 30
    assert len(data["task_updates"]) == 4

    print("POST /simulate/optimize test passed!")
    print(f"Original Peak Risk: {data['before_peak_risk']}%")
    print(f"Optimized Peak Risk: {data['after_peak_risk']}%")
    print(f"Risk Reduction: {data['risk_reduction_percent']}%")
    print(f"Task updates: {data['task_updates']}")

if __name__ == "__main__":
    test_optimize_endpoint()
