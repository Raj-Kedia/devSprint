import asyncio
from email.message import EmailMessage
import html
import logging
import smtplib
from typing import Dict, List, Optional
from app.core.config import settings

logger = logging.getLogger("devsprint.email")


class EmailService:
    """Async Gmail/SMTP email delivery service for verification, password resets, and team invites."""

    def __init__(self):
        # Used only in automated tests when SMTP credentials are absent
        self.test_outbox: List[Dict[str, str]] = []

    def is_configured(self) -> bool:
        return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)

    def _sender_address(self) -> str:
        return settings.SMTP_FROM_EMAIL or settings.SMTP_USER or "noreply@devsprint.local"

    def _send_sync(self, msg: EmailMessage) -> None:
        host = settings.SMTP_HOST
        port = settings.SMTP_PORT
        username = settings.SMTP_USER
        password = settings.SMTP_PASSWORD

        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(username, password)
                server.send_message(msg)

    def _render_html(
        self,
        heading: str,
        body_html: str,
        cta_label: Optional[str] = None,
        cta_url: Optional[str] = None,
        footer_note: str = "If you didn't request this email, you can safely ignore it."
    ) -> str:
        cta_block = ""
        if cta_label and cta_url:
            safe_url = html.escape(cta_url, quote=True)
            safe_label = html.escape(cta_label)
            cta_block = f"""
              <div style="margin: 24px 0;">
                <a href="{safe_url}"
                   style="display:inline-block;padding:12px 22px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
                  {safe_label}
                </a>
              </div>
              <p style="font-size:12px;color:#71717a;word-break:break-all;">
                Or copy this link into your browser:<br />
                <a href="{safe_url}" style="color:#4f46e5;">{safe_url}</a>
              </p>
            """

        return f"""<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#18181b;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:28px;">
      <div style="font-size:16px;font-weight:700;margin-bottom:18px;">DevSprint</div>
      <h2 style="margin:0 0 12px 0;font-size:20px;color:#18181b;">{html.escape(heading)}</h2>
      <div style="font-size:14px;line-height:1.6;color:#3f3f46;">
        {body_html}
      </div>
      {cta_block}
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0 14px 0;" />
      <p style="margin:0;font-size:12px;color:#71717a;">{html.escape(footer_note)}</p>
    </div>
  </body>
</html>"""

    async def send_email(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str
    ) -> bool:
        if settings.ENVIRONMENT == "test":
            self.test_outbox.append({
                "to": to_email,
                "subject": subject,
                "text": text_body,
                "html": html_body,
            })

        if not self.is_configured():
            logger.warning(
                "SMTP credentials (SMTP_USER / SMTP_PASSWORD) not configured; "
                "email '%s' to '%s' was not dispatched.",
                subject,
                to_email,
            )
            return False

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{self._sender_address()}>"
        msg["To"] = to_email
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

        try:
            await asyncio.to_thread(self._send_sync, msg)
            logger.info("Email '%s' delivered to '%s'", subject, to_email)
            return True
        except Exception as exc:
            logger.error("Failed to send email '%s' to '%s': %s", subject, to_email, exc)
            return False

    async def send_verification_email(self, to_email: str, name: str, verify_url: str) -> bool:
        safe_name = html.escape(name)
        subject = "Verify your DevSprint email address"
        text_body = (
            f"Hi {name},\n\n"
            f"Please verify your email address to activate your DevSprint account:\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours.\n"
        )
        html_body = self._render_html(
            heading="Verify your email address",
            body_html=(
                f"<p>Hi <strong>{safe_name}</strong>,</p>"
                "<p>Thanks for creating your DevSprint account. Please verify your email address "
                "before signing in with your email and password.</p>"
            ),
            cta_label="Verify Email Address",
            cta_url=verify_url,
            footer_note="This verification link expires in 24 hours."
        )
        return await self.send_email(to_email, subject, text_body, html_body)

    async def send_password_reset_email(self, to_email: str, name: str, reset_url: str) -> bool:
        safe_name = html.escape(name)
        subject = "Reset your DevSprint password"
        text_body = (
            f"Hi {name},\n\n"
            f"We received a request to reset your DevSprint password. Open this link to set a new password:\n"
            f"{reset_url}\n\n"
            f"This link expires in 1 hour. If you did not request a reset, ignore this message.\n"
        )
        html_body = self._render_html(
            heading="Reset your password",
            body_html=(
                f"<p>Hi <strong>{safe_name}</strong>,</p>"
                "<p>We received a request to reset the password for your DevSprint account. "
                "Click the button below to choose a new password.</p>"
            ),
            cta_label="Reset Password",
            cta_url=reset_url,
            footer_note="This password reset link expires in 1 hour."
        )
        return await self.send_email(to_email, subject, text_body, html_body)

    async def send_team_invite_email(
        self,
        to_email: str,
        team_name: str,
        inviter_name: str,
        role: str,
        login_url: str,
        default_password: Optional[str] = None
    ) -> bool:
        safe_team = html.escape(team_name)
        safe_inviter = html.escape(inviter_name)
        safe_role = html.escape(role.upper())
        subject = f"You're invited to join {team_name} on DevSprint"

        if default_password:
            safe_email = html.escape(to_email)
            safe_pwd = html.escape(default_password)
            text_body = (
                f"Hi,\n\n"
                f"{inviter_name} invited you to join '{team_name}' on DevSprint as {role.upper()}.\n\n"
                f"An account has been created for you with a temporary default password:\n"
                f"Email: {to_email}\n"
                f"Default Password: {default_password}\n\n"
                f"Sign in here: {login_url}\n"
                f"We recommend changing your password after logging in.\n"
            )
            body_html = (
                f"<p><strong>{safe_inviter}</strong> invited you to join workspace "
                f"<strong>{safe_team}</strong> on DevSprint as <strong>{safe_role}</strong>.</p>"
                "<p>Your account has been created. Use these credentials to sign in:</p>"
                "<div style=\"background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:14px;margin:14px 0;font-family:monospace;font-size:13px;\">"
                f"<div><strong>Email:</strong> {safe_email}</div>"
                f"<div style=\"margin-top:6px;\"><strong>Temporary Password:</strong> {safe_pwd}</div>"
                "</div>"
                "<p>Please update your password once you log in (or sign in with Google if this is your Google email).</p>"
            )
        else:
            text_body = (
                f"Hi,\n\n"
                f"{inviter_name} added you to '{team_name}' on DevSprint as {role.upper()}.\n\n"
                f"Sign in with your existing DevSprint account here:\n"
                f"{login_url}\n"
            )
            body_html = (
                f"<p><strong>{safe_inviter}</strong> added you to workspace "
                f"<strong>{safe_team}</strong> on DevSprint as <strong>{safe_role}</strong>.</p>"
                "<p>Sign in with your existing DevSprint account to start collaborating.</p>"
            )

        html_body = self._render_html(
            heading=f"Join {team_name} on DevSprint",
            body_html=body_html,
            cta_label="Join Workspace",
            cta_url=login_url,
            footer_note="You received this invite because a DevSprint workspace admin added your email."
        )
        return await self.send_email(to_email, subject, text_body, html_body)


email_service = EmailService()

