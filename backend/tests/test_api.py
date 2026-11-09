import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_db()


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/system/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_login_demo_user():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/auth/login",
            json={"email": "alex@devsprint.io", "password": "password123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "alex@devsprint.io"


@pytest.mark.asyncio
async def test_sprint_board_and_cache():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Login
        login_res = await ac.post(
            "/api/v1/auth/login",
            json={"email": "alex@devsprint.io", "password": "password123"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Clear cache first
        await ac.post("/api/v1/system/cache-clear", headers=headers)

        # 1st call -> MISS
        res1 = await ac.get("/api/v1/sprints/1/board", headers=headers)
        assert res1.status_code == 200
        board1 = res1.json()
        assert "columns" in board1
        assert "TODO" in board1["columns"]
        assert "DONE" in board1["columns"]

        # 2nd call -> HIT
        res2 = await ac.get("/api/v1/sprints/1/board", headers=headers)
        assert res2.status_code == 200
        assert res2.headers.get("X-Cache") == "HIT" or res2.json().get("cached") is True


@pytest.mark.asyncio
async def test_standup_agent_generation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/v1/auth/login",
            json={"email": "alex@devsprint.io", "password": "password123"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await ac.post(
            "/api/v1/standup/generate",
            headers=headers,
            json={"sprint_id": 1, "custom_prompt_context": "Test automated verification"}
        )
        assert response.status_code == 200
        report = response.json()
        assert "summary" in report
        assert "yesterday" in report
        assert "today" in report
        assert "blockers" in report


@pytest.mark.asyncio
async def test_burndown_analytics():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post(
            "/api/v1/auth/login",
            json={"email": "alex@devsprint.io", "password": "password123"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        response = await ac.get("/api/v1/analytics/sprint/1", headers=headers)
        assert response.status_code == 200
        analytics = response.json()
        assert "burndown" in analytics
        assert len(analytics["burndown"]) > 0
        assert "total_points" in analytics
        assert analytics["total_points"] > 0


@pytest.mark.asyncio
async def test_role_based_permissions():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Login as Member (Sam Chen)
        member_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": "sam@devsprint.io", "password": "password123"}
        )
        assert member_login.status_code == 200
        member_token = member_login.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}

        # Member attempts to create sprint -> Must fail with 403
        bad_sprint_res = await ac.post(
            "/api/v1/sprints/",
            headers=member_headers,
            json={
                "team_id": 1,
                "name": "Unauthorized Sprint",
                "start_date": "2026-11-09T00:00:00Z",
                "end_date": "2026-11-23T00:00:00Z",
                "status": "active"
            }
        )
        assert bad_sprint_res.status_code == 403
        assert "Only team admins" in bad_sprint_res.json()["detail"]

        # Member attempts to invite teammate -> Must fail with 403
        bad_invite_res = await ac.post(
            "/api/v1/teams/1/invite",
            headers=member_headers,
            json={"email": "newdev@devsprint.io", "role": "member"}
        )
        assert bad_invite_res.status_code == 403
        assert "Only team admins" in bad_invite_res.json()["detail"]

        # 2. Login as Admin (Alex Rivera)
        admin_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": "alex@devsprint.io", "password": "password123"}
        )
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Admin creates sprint -> Must succeed (200)
        good_sprint_res = await ac.post(
            "/api/v1/sprints/",
            headers=admin_headers,
            json={
                "team_id": 1,
                "name": "Sprint 25 — Advanced Roles",
                "start_date": "2026-11-10T00:00:00Z",
                "end_date": "2026-11-24T00:00:00Z",
                "status": "planning"
            }
        )
        assert good_sprint_res.status_code == 200
        assert good_sprint_res.json()["name"] == "Sprint 25 — Advanced Roles"
