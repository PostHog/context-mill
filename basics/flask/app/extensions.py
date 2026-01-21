"""Flask extensions initialized without binding to app."""

from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

login_manager = LoginManager()
login_manager.login_view = "main.home"
login_manager.login_message = "Please log in to access this page."
