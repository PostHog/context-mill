"""User model with SQLite persistence (similar to Django's auth.User)."""

from datetime import datetime, timezone

from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


class User(UserMixin, db.Model):
    """User model with SQLite persistence."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(254), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_staff = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    date_joined = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def set_password(self, password):
        """Hash and set the user's password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify the password against the hash."""
        return check_password_hash(self.password_hash, password)

    @classmethod
    def create_user(cls, email, password, is_staff=False):
        """Create and save a new user."""
        user = cls(email=email, is_staff=is_staff)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return user

    @classmethod
    def get_by_id(cls, user_id):
        """Get user by ID."""
        return cls.query.get(int(user_id))

    @classmethod
    def get_by_email(cls, email):
        """Get user by email."""
        return cls.query.filter_by(email=email).first()

    @classmethod
    def authenticate(cls, email, password):
        """Authenticate user with email and password."""
        user = cls.get_by_email(email)
        if user and user.check_password(password):
            return user
        return None

    def __repr__(self):
        return f"<User {self.email}>"
