import base64
import hashlib
import hmac
import json
import os
import time
import zlib


def _base64_url_encode(raw: bytes) -> str:
    encoded = base64.b64encode(raw).decode("utf-8")
    return encoded.replace("+", "*").replace("/", "-").replace("=", "_")


def generate_user_sig(user_id: str, sdk_app_id: int, expire: int = 86400) -> str:
    secret_key = os.getenv("TRTC_SDK_SECRET_KEY")
    if not secret_key:
        raise RuntimeError("TRTC_SDK_SECRET_KEY is not configured")

    current_time = int(time.time())
    content = (
        f"TLS.identifier:{user_id}\n"
        f"TLS.sdkappid:{sdk_app_id}\n"
        f"TLS.time:{current_time}\n"
        f"TLS.expire:{expire}\n"
    )
    signature = base64.b64encode(
        hmac.new(secret_key.encode("utf-8"), content.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8")

    payload = {
        "TLS.ver": "2.0",
        "TLS.identifier": user_id,
        "TLS.sdkappid": sdk_app_id,
        "TLS.expire": expire,
        "TLS.time": current_time,
        "TLS.sig": signature,
    }
    compressed = zlib.compress(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return _base64_url_encode(compressed)
