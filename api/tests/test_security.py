import pytest
import jwt
from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_hash_and_verify():
    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert verify_password("mysecretpassword", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_access_token_encode_decode():
    token = create_access_token("user-123")
    payload = decode_token(token, token_type="access")
    assert payload["sub"] == "user-123"


def test_refresh_token_not_accepted_as_access():
    from app.core.security import create_refresh_token
    refresh = create_refresh_token("user-123")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(refresh, token_type="access")


def test_invalid_token_raises():
    with pytest.raises(jwt.PyJWTError):
        decode_token("not.a.valid.token")
