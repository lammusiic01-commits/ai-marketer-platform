import logging
from email.message import EmailMessage
import aiosmtplib
from app.config import APP_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM

logger = logging.getLogger("ai_marketer.email")

async def send_invitation(email: str, token: str, workspace: str):
    url = f"{APP_URL}/invite/{token}"
    if SMTP_HOST:
        message = EmailMessage()
        message["Subject"] = f"Приглашение в workspace «{workspace}»"
        message["From"] = SMTP_FROM
        message["To"] = email
        message.set_content(f"Вас пригласили в рабочее пространство «{workspace}».\n\nПримите приглашение по ссылке (действует 7 дней):\n{url}\n")
        try:
            await aiosmtplib.send(
                message,
                hostname=SMTP_HOST,
                port=SMTP_PORT,
                username=SMTP_USER or None,
                password=SMTP_PASSWORD or None,
                start_tls=SMTP_PORT == 587,
                use_tls=SMTP_PORT == 465,
            )
            logger.info("Приглашение отправлено на %s в workspace %s", email, workspace)
        except Exception:
            logger.exception("Не удалось отправить приглашение на %s; URL доступен в ответе API", email)
    else:
        logger.info("Приглашение в workspace %s для %s: %s", workspace, email, url)
    return url
