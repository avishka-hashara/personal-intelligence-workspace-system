from fastapi.testclient import TestClient
from main import app
from seeder import generate_historical_data, generate_seeded_current_state

client = TestClient(app)

def test_seeder_direct_function():
    data_90 = generate_historical_data(days=90)
    assert data_90["timeframe"]["total_days"] == 90
    assert len(data_90["daily_logs"]) == 90
    assert "summary_statistics" in data_90
    
    stats = data_90["summary_statistics"]
    assert "average_burnout_risk" in stats
    assert "total_bottleneck_days" in stats
    print("Direct 90-day seeder test passed!")
    print(f"90-Day Summary Stats: {stats}")

def test_mock_state_endpoint():
    response = client.get("/simulate/mock-state")
    assert response.status_code == 200
    data = response.json()
    assert "tasks" in data and len(data["tasks"]) > 0
    assert "habits" in data and len(data["habits"]) > 0
    assert "health_metrics" in data
    print("GET /simulate/mock-state test passed!")

def test_seed_data_endpoint():
    response = client.get("/simulate/seed-data?days=180")
    assert response.status_code == 200
    data = response.json()
    assert data["timeframe"]["total_days"] == 180
    assert len(data["daily_logs"]) == 180
    print("GET /simulate/seed-data?days=180 test passed!")

def test_seeded_state_with_timeline_simulation():
    # Fetch mock state
    state_res = client.get("/simulate/mock-state")
    assert state_res.status_code == 200
    mock_state = state_res.json()

    # Pass seeded state directly into simulate endpoint
    sim_res = client.post("/simulate/timeline", json=mock_state)
    assert sim_res.status_code == 200
    sim_data = sim_res.json()

    assert len(sim_data["risk_scores"]) == 30
    assert "predicted_bottleneck_dates" in sim_data
    print("Full End-to-End Seeded Timeline Simulation passed!")
    print(f"Recommendations for seeded state: {sim_data['alternate_schedule_recommendations']}")

if __name__ == "__main__":
    test_seeder_direct_function()
    test_mock_state_endpoint()
    test_seed_data_endpoint()
    test_seeded_state_with_timeline_simulation()
