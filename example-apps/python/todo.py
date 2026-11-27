#!/usr/bin/env python3
"""Simple CLI Todo App with PostHog Analytics

A minimal plain Python CLI application demonstrating PostHog integration
for non-framework Python projects (CLIs, scripts, data pipelines, etc.).
"""

import argparse
import atexit
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from posthog import Posthog

# Load environment variables
load_dotenv()

# Data file location
DATA_FILE = Path.home() / ".todo_app.json"


def initialize_posthog():
    """Initialize PostHog with instance-based API.

    Returns PostHog instance or None if project token is not configured.
    """
    # Return None when POSTHOG_PROJECT_TOKEN is unset or blank instead of passing
    # an empty or placeholder token to Posthog(), which would raise ValueError or send invalid requests.
    project_token = (os.getenv("POSTHOG_PROJECT_TOKEN") or "").strip()

    if not project_token:
        env = os.getenv("ENV", os.getenv("PYTHON_ENV", "development")).lower()
        if env != "production":
            print(
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, "
                "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
                file=sys.stderr,
            )
        return None

    client = Posthog(
        project_token,
        host=os.getenv("POSTHOG_HOST", "https://us.i.posthog.com"),
        debug=os.getenv("POSTHOG_DEBUG", "False").lower() == "true",
        enable_exception_autocapture=True,
    )
    atexit.register(client.shutdown)
    return client


def get_user_id():
    """Get or create a persistent user ID for this installation."""
    data = {"todos": []}
    if DATA_FILE.exists():
        data = json.loads(DATA_FILE.read_text())
        existing_id = (data.get("user_id") or "").strip()
        if existing_id:
            return existing_id

    # Persist the generated UUID immediately so read-only commands like list or stats
    # and error handlers reuse one stable distinct_id instead of creating throwaway person IDs.
    user_id = str(uuid.uuid4())
    data["user_id"] = user_id
    data.setdefault("todos", [])
    save_todos(data)
    return user_id


def load_todos():
    """Load todos from disk."""
    user_id = get_user_id()
    data = json.loads(DATA_FILE.read_text())
    data["user_id"] = user_id
    data.setdefault("todos", [])
    return data


def save_todos(data):
    """Save todos to disk."""
    DATA_FILE.write_text(json.dumps(data, indent=2))


def track_event(posthog_client, event_name, properties=None):
    """Track an event with PostHog."""
    if not posthog_client:
        return

    posthog_client.capture(
        distinct_id=get_user_id(),
        event=event_name,
        properties=properties or {},
    )


def cmd_add(args, posthog_client):
    """Add a new todo item."""
    data = load_todos()

    todo = {
        "id": len(data["todos"]) + 1,
        "text": args.text,
        "completed": False,
        "created_at": datetime.now().isoformat(),
    }

    data["todos"].append(todo)
    save_todos(data)

    print(f"Added todo #{todo['id']}: {todo['text']}")

    track_event(posthog_client, "todo_added", {
        "todo_id": todo["id"],
        "todo_length": len(todo["text"]),
        "total_todos": len(data["todos"]),
    })


def cmd_list(args, posthog_client):
    """List all todos."""
    data = load_todos()

    if not data["todos"]:
        print("No todos yet! Add one with: todo add 'Your task'")
        return

    print(f"\nYour Todos ({len(data['todos'])} total):\n")

    for todo in data["todos"]:
        status = "X" if todo["completed"] else " "
        print(f"  [{status}] #{todo['id']}: {todo['text']}")

    print()

    track_event(posthog_client, "todos_viewed", {
        "total_todos": len(data["todos"]),
        "completed_todos": sum(1 for t in data["todos"] if t["completed"]),
    })


def cmd_complete(args, posthog_client):
    """Mark a todo as completed."""
    data = load_todos()

    todo = next((t for t in data["todos"] if t["id"] == args.id), None)

    if not todo:
        print(f"ERROR: Todo #{args.id} not found")
        return

    if todo["completed"]:
        print(f"Todo #{args.id} is already completed")
        return

    todo["completed"] = True
    todo["completed_at"] = datetime.now().isoformat()
    save_todos(data)

    print(f"Completed todo #{todo['id']}: {todo['text']}")

    track_event(posthog_client, "todo_completed", {
        "todo_id": todo["id"],
        "time_to_complete_hours": (
            datetime.fromisoformat(todo["completed_at"]) -
            datetime.fromisoformat(todo["created_at"])
        ).total_seconds() / 3600,
    })


def cmd_delete(args, posthog_client):
    """Delete a todo."""
    data = load_todos()

    todo = next((t for t in data["todos"] if t["id"] == args.id), None)

    if not todo:
        print(f"ERROR: Todo #{args.id} not found")
        return

    data["todos"].remove(todo)
    save_todos(data)

    print(f"Deleted todo #{args.id}")

    track_event(posthog_client, "todo_deleted", {
        "todo_id": todo["id"],
        "was_completed": todo["completed"],
    })


def cmd_stats(args, posthog_client):
    """Show usage statistics."""
    data = load_todos()

    total = len(data["todos"])
    completed = sum(1 for t in data["todos"] if t["completed"])
    pending = total - completed

    print("\nStats:\n")
    print(f"  Total todos:     {total}")
    print(f"  Completed:       {completed}")
    print(f"  Pending:         {pending}")
    print(f"  Completion rate: {(completed / total * 100) if total > 0 else 0:.1f}%")
    print()

    track_event(posthog_client, "stats_viewed", {
        "total_todos": total,
        "completed_todos": completed,
        "pending_todos": pending,
    })


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Simple todo app with PostHog analytics"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    add_parser = subparsers.add_parser("add", help="Add a new todo")
    add_parser.add_argument("text", help="Todo text")

    subparsers.add_parser("list", help="List all todos")

    complete_parser = subparsers.add_parser("complete", help="Mark todo as completed")
    complete_parser.add_argument("id", type=int, help="Todo ID")

    delete_parser = subparsers.add_parser("delete", help="Delete a todo")
    delete_parser.add_argument("id", type=int, help="Todo ID")

    subparsers.add_parser("stats", help="Show statistics")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    posthog_client = initialize_posthog()

    try:
        if args.command == "add":
            cmd_add(args, posthog_client)
        elif args.command == "list":
            cmd_list(args, posthog_client)
        elif args.command == "complete":
            cmd_complete(args, posthog_client)
        elif args.command == "delete":
            cmd_delete(args, posthog_client)
        elif args.command == "stats":
            cmd_stats(args, posthog_client)

    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)

        if posthog_client:
            posthog_client.capture_exception(e, distinct_id=get_user_id())

        sys.exit(1)

    finally:
        # Flush queued events before the CLI process exits without failing if PostHog is unreachable.
        if posthog_client:
            try:
                posthog_client.shutdown()
            except Exception:
                pass


if __name__ == "__main__":
    main()
