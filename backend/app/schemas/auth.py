import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    email: str
    exp: int


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: Optional[str] = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    is_superuser: bool
    created_at: datetime


class MembershipOrgRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    organization_id: uuid.UUID
    organization_name: str
    organization_slug: str
    role: str


class UserProfile(UserRead):
    memberships: List[MembershipOrgRead] = []
