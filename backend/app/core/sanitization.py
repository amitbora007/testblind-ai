import re
from typing import Tuple


# Regex patterns for sensitive secret and PII detection
AWS_KEY_PATTERN = re.compile(r"\b(AKIA[0-9A-Z]{16})\b")
TOKEN_PATTERN = re.compile(
    r"\b(ghp_[0-9a-zA-Z]{20,60}|github_pat_[0-9a-zA-Z_]{20,100}|glpat-[0-9a-zA-Z\-]{15,50}|tb_live_[0-9a-zA-Z_]{10,50}|tb_[0-9a-zA-Z_]{10,50}|sk-[0-9a-zA-Z]{20,})\b"
)
BEARER_PATTERN = re.compile(r"Bearer\s+([A-Za-z0-9\-\._~\+\/]{16,}=*)")
JWT_PATTERN = re.compile(
    r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"
)
DB_URI_PASSWORD_PATTERN = re.compile(
    r"((?:postgres(?:ql)?|mysql|redis|mongodb):\/\/[^:\s]+:)([^@\s]+)(@)"
)
KEY_VALUE_SECRET_PATTERN = re.compile(
    r"""(?i)\b(password|secret|passwd|auth_token|api_key)\s*[:=]\s*["']?([^"'\s,;]+)["']?"""
)
CREDIT_CARD_PATTERN = re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b")
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b")
PRIVATE_KEY_PATTERN = re.compile(
    r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----"
)


def sanitize_sensitive_data(text: str) -> Tuple[str, int]:
    """
    Sanitizes raw stack traces, logs, and user incident descriptions by redacting
    sensitive API tokens, private keys, passwords, database credentials, and PII.

    Returns:
        Tuple[str, int]: (sanitized_text, redaction_count)
    """
    if not text:
        return text, 0

    redactions = 0
    sanitized = text

    # 1. Private keys
    sanitized, n = PRIVATE_KEY_PATTERN.subn("[REDACTED_PRIVATE_KEY]", sanitized)
    redactions += n

    # 2. Database URI credentials
    sanitized, n = DB_URI_PASSWORD_PATTERN.subn(r"\g<1>[REDACTED_PASSWORD]\g<3>", sanitized)
    redactions += n

    # 3. JWT Tokens
    sanitized, n = JWT_PATTERN.subn("[REDACTED_JWT_TOKEN]", sanitized)
    redactions += n

    # 4. Bearer tokens
    sanitized, n = BEARER_PATTERN.subn("Bearer [REDACTED_BEARER_TOKEN]", sanitized)
    redactions += n

    # 5. Vendor tokens (AWS, GitHub, TestBlind)
    sanitized, n = AWS_KEY_PATTERN.subn("[REDACTED_AWS_KEY]", sanitized)
    redactions += n
    sanitized, n = TOKEN_PATTERN.subn("[REDACTED_API_TOKEN]", sanitized)
    redactions += n

    # 6. Key-Value secrets
    sanitized, n = KEY_VALUE_SECRET_PATTERN.subn(r'\1: "[REDACTED_SECRET]"', sanitized)
    redactions += n

    # 7. Credit cards
    sanitized, n = CREDIT_CARD_PATTERN.subn("[REDACTED_CREDIT_CARD]", sanitized)
    redactions += n

    # 8. Emails
    sanitized, n = EMAIL_PATTERN.subn("[REDACTED_EMAIL]", sanitized)
    redactions += n

    return sanitized, redactions
