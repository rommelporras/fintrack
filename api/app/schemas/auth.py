from pydantic import BaseModel, EmailStr, Field
import uuid


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar: str | None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
