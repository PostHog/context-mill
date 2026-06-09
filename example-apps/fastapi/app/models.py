"""User model with SQLite persistence (similar to Flask example)."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column
from werkzeug.security import check_password_hash, generate_password_hash

from app.database import Base


class User(Base):
    """User model with SQLite persistence."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    login_count: Mapped[int] = mapped_column(Integer, default=0)
    date_joined: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def set_password(self, password: str) -> None:
        """Hash and set the user's password."""
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    def check_password(self, password: str) -> bool:
        """Verify the password against the hash."""
        return check_password_hash(self.password_hash, password)

    @classmethod
    def create_user(
        cls, db: Session, email: str, password: str, is_staff: bool = False
    ) -> "User":
        """Create and save a new user."""
        user = cls(email=email, is_staff=is_staff)
        # nosemgrep: python.django.security.audit.unvalidated-password.unvalidated-password
        user.set_password(password)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def get_by_id(cls, db: Session, user_id: int) -> Optional["User"]:
        """Get user by ID."""
        return db.query(cls).filter(cls.id == user_id).first()

    @classmethod
    def get_by_email(cls, db: Session, email: str) -> Optional["User"]:
        """Get user by email."""
        return db.query(cls).filter(cls.email == email).first()

    @classmethod
    def authenticate(cls, db: Session, email: str, password: str) -> Optional["User"]:
        """Authenticate user with email and password."""
        user = cls.get_by_email(db, email)
        if user and user.check_password(password):
            return user
        return None

    def record_login(self, db: Session) -> bool:
        """Record a login and return whether this is the user's first login."""
        is_first_login = self.login_count == 0
        self.login_count += 1
        db.commit()
        return is_first_login

    def update_profile(self, db: Session, name: Optional[str] = None) -> list:
        """Update user profile and return list of changed fields."""
        changed_fields = []
        if name is not None and name != self.name:
            self.name = name
            changed_fields.append("name")
        if changed_fields:
            db.commit()
        return changed_fields

    def __repr__(self) -> str:
        return f"<User {self.email}>"
