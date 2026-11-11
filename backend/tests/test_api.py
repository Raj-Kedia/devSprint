import re
from urllib.parse import unquote
from uuid import uuid4
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.core.database import init_db
from app.services.email_service import email_service


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await init_db()
    from app.seed import seed_data
    await seed_data()


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


@pytest.mark.asyncio
async def test_email_verification_and_forgot_password(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    email_service.test_outbox.clear()
    unique_email = f"verify_{uuid4().hex[:8]}@example.com"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register -> must require email verification
        reg_res = await ac.post(
            "/api/v1/auth/register",
            json={"name": "Verify Tester", "email": unique_email, "password": "Password123"}
        )
        assert reg_res.status_code == 200
        assert reg_res.json()["requires_verification"] is True
        assert len(email_service.test_outbox) == 1
        verify_email_msg = email_service.test_outbox[-1]
        assert verify_email_msg["to"] == unique_email
        match = re.search(r"verify_token=([^\s&]+)", verify_email_msg["text"])
        assert match is not None
        verify_token = unquote(match.group(1))

        # 2. Login before verification -> 403 and sends fresh verification mail
        blocked_res = await ac.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "Password123"}
        )
        assert blocked_res.status_code == 403
        assert len(email_service.test_outbox) == 2
        fresh_match = re.search(r"verify_token=([^\s&]+)", email_service.test_outbox[-1]["text"])
        assert fresh_match is not None
        fresh_verify_token = unquote(fresh_match.group(1))

        # Prior token was invalidated when a fresh one was issued
        stale_res = await ac.post("/api/v1/auth/verify-email", json={"token": verify_token})
        assert stale_res.status_code == 400

        # 3. Verify using latest link -> succeeds & logs in
        verify_res = await ac.post("/api/v1/auth/verify-email", json={"token": fresh_verify_token})
        assert verify_res.status_code == 200
        assert verify_res.json()["user"]["is_verified"] is True

        # 4. Login now succeeds
        login_res = await ac.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "Password123"}
        )
        assert login_res.status_code == 200

        # 5. Forgot password -> reset password -> single use
        email_service.test_outbox.clear()
        forgot_res = await ac.post("/api/v1/auth/forgot-password", json={"email": unique_email})
        assert forgot_res.status_code == 200
        assert len(email_service.test_outbox) == 1
        reset_match = re.search(r"reset_token=([^\s&]+)", email_service.test_outbox[-1]["text"])
        assert reset_match is not None
        reset_token = unquote(reset_match.group(1))

        reset_res = await ac.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_token, "new_password": "NewPassword456"}
        )
        assert reset_res.status_code == 200

        # Token cannot be reused
        reuse_res = await ac.post(
            "/api/v1/auth/reset-password",
            json={"token": reset_token, "new_password": "AnotherPassword"}
        )
        assert reuse_res.status_code == 400

        # Old password fails, new password works
        old_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "Password123"}
        )
        assert old_login.status_code == 401
        new_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": unique_email, "password": "NewPassword456"}
        )
        assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_google_auth_and_team_invite_email(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-google-client-id.apps.googleusercontent.com")
    email_service.test_outbox.clear()

    google_email = f"google_{uuid4().hex[:8]}@gmail.com"
    invited_email = f"invitee_{uuid4().hex[:8]}@example.com"

    def fake_verify_google(credential: str):
        assert credential == "mock-google-id-token"
        return {
            "sub": f"google-sub-{uuid4().hex[:8]}",
            "email": google_email,
            "email_verified": True,
            "name": "Google User"
        }

    monkeypatch.setattr("app.api.v1.auth.verify_google_id_token", fake_verify_google)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        cfg_res = await ac.get("/api/v1/auth/config")
        assert cfg_res.status_code == 200
        assert cfg_res.json()["google_enabled"] is True

        g_res = await ac.post("/api/v1/auth/google", json={"credential": "mock-google-id-token"})
        assert g_res.status_code == 200
        g_data = g_res.json()
        assert g_data["user"]["email"] == google_email
        assert g_data["user"]["is_verified"] is True

        # Admin invites a brand-new teammate -> sends mail with generated default password
        admin_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": "alex@devsprint.io", "password": "password123"}
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        invite_res = await ac.post(
            "/api/v1/teams/1/invite",
            headers=admin_headers,
            json={"email": invited_email, "role": "member"}
        )
        assert invite_res.status_code == 200
        assert len(email_service.test_outbox) == 1
        invite_mail = email_service.test_outbox[-1]
        assert invite_mail["to"] == invited_email
        pwd_match = re.search(r"Default Password:\s*(\S+)", invite_mail["text"])
        assert pwd_match is not None
        temp_password = pwd_match.group(1)

        # Invited teammate signs in with default password from email
        invitee_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": invited_email, "password": temp_password}
        )
        assert invitee_login.status_code == 200
        invitee_data = invitee_login.json()
        assert invitee_data["user"]["must_change_password"] is True

        # Invited teammate updates their password
        invitee_headers = {"Authorization": f"Bearer {invitee_data['access_token']}"}
        change_res = await ac.post(
            "/api/v1/auth/change-password",
            headers=invitee_headers,
            json={"new_password": "CustomStrongPassword1!"}
        )
        assert change_res.status_code == 200

        # Confirm updated password works
        final_login = await ac.post(
            "/api/v1/auth/login",
            json={"email": invited_email, "password": "CustomStrongPassword1!"}
        )
        assert final_login.status_code == 200

