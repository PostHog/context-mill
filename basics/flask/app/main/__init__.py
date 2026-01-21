"""Main blueprint registration."""

from flask import Blueprint

main_bp = Blueprint("main", __name__, template_folder="../templates")

from app.main import routes  # noqa: E402, F401
