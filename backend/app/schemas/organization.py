import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr
from app.models.user import RoleEnum


class OrganizationCreate(BaseModel):
    name: str
    slug: Optional[str] = None


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    billing_plan: str
    created_at: datetime


class MemberInvite(BaseModel):
    email: EmailStr
    role: RoleEnum = RoleEnum.ENGINEER
    full_name: Optional[str] = None


class MemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    email: EmailStr
    full_name: str
    role: RoleEnum
    created_at: datetime
