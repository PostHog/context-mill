#!/usr/bin/env python3
"""Simple CLI Todo App with PostHog Analytics

A minimal plain Python CLI application demonstrating PostHog integration
for non-framework Python projects (CLIs, scripts, data pipelines, etc.).
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from posthog import Posthog, new_context, identify_context, capture

# Load environment variables
load_dotenv()

# Data file location
DATA_FILE = Path.home() / ".todo_app.json"


def initialize_posthog():
    """Initialize PostHog with instance-based API.

    Returns PostHog instance or None if API key not configured.
    """
    api_key = os.getenv('POSTHOG_API_KEY')

    if not api_key:
        print("WARNING: PostHog not configured (POSTHOG_API_KEY not set)")
        print("         App will work but analytics won't be tracked")
        return None

    # Create PostHog instance with opinionated defaults
    posthog = Posthog(
        api_key,
        host=os.getenv('POSTHOG_HOST', 'https://us.i.posthog.com'),
        debug=os.getenv('POSTHOG_DEBUG', 'False').lower() == 'true',
        enable_exception_autocapture=True  # Auto-capture unhandled exceptions
    )

    return posthog


def get_user_id():
    """Get or create a user ID for this installation.

    Uses a UUID stored in the data file to represent this user.
    In a real app, this would be your actual user ID.
    """
    import uuid

    if DATA_FILE.exists():
        data = json.loads(DATA_FILE.read_text())
        if 'user_id' in data:
            return data['user_id']

    # Create new user ID
    return f"user_{uuid.uuid4().hex[:8]}"


def load_todos():
    """Load todos from disk."""
    if not DATA_FILE.exists():
        return {"user_id": get_user_id(), "todos": []}

    return json.loads(DATA_FILE.read_text())


def save_todos(data):
    """Save todos to disk."""
    DATA_FILE.write_text(json.dumps(data, indent=2))


def track_event(posthog, event_name, properties=None):
    """Track an event with PostHog using proper context pattern.

    Demonstrates the opinionated pattern: new_context() -> identify_context() -> capture()
    """
    if not posthog:
        return

    with new_context():
        identify_context(get_user_id())
        capture(event_name, properties=properties or {})


def cmd_add(args, posthog):
    """Add a new todo item."""
    data = load_todos()

    todo = {
        "id": len(data["todos"]) + 1,
        "text": args.text,
        "completed": False,
        "created_at": datetime.now().isoformat()
    }

    data["todos"].append(todo)
    save_todos(data)

    print(f"Added todo #{todo['id']}: {todo['text']}")

    # Track the event
    track_event(posthog, "todo_added", {
        "todo_id": todo["id"],
        "todo_length": len(todo["text"]),
        "total_todos": len(data["todos"])
    })


def cmd_list(args, posthog):
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

    # Track the event
    track_event(posthog, "todos_viewed", {
        "total_todos": len(data["todos"]),
        "completed_todos": sum(1 for t in data["todos"] if t["completed"])
    })


def cmd_complete(args, posthog):
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

    # Track the event
    track_event(posthog, "todo_completed", {
        "todo_id": todo["id"],
        "time_to_complete_hours": (
            datetime.fromisoformat(todo["completed_at"]) -
            datetime.fromisoformat(todo["created_at"])
        ).total_seconds() / 3600
    })


def cmd_delete(args, posthog):
    """Delete a todo."""
    data = load_todos()

    todo = next((t for t in data["todos"] if t["id"] == args.id), None)

    if not todo:
        print(f"ERROR: Todo #{args.id} not found")
        return

    data["todos"].remove(todo)
    save_todos(data)

    print(f"Deleted todo #{args.id}")

    # Track the event
    track_event(posthog, "todo_deleted", {
        "todo_id": todo["id"],
        "was_completed": todo["completed"]
    })


def cmd_stats(args, posthog):
    """Show usage statistics."""
    data = load_todos()

    total = len(data["todos"])
    completed = sum(1 for t in data["todos"] if t["completed"])
    pending = total - completed

    print(f"\nStats:\n")
    print(f"  Total todos:     {total}")
    print(f"  Completed:       {completed}")
    print(f"  Pending:         {pending}")
    print(f"  Completion rate: {(completed/total*100) if total > 0 else 0:.1f}%")
    print()

    # Track the event
    track_event(posthog, "stats_viewed", {
        "total_todos": total,
        "completed_todos": completed,
        "pending_todos": pending
    })


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Simple todo app with PostHog analytics"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Add command
    add_parser = subparsers.add_parser("add", help="Add a new todo")
    add_parser.add_argument("text", help="Todo text")

    # List command
    subparsers.add_parser("list", help="List all todos")

    # Complete command
    complete_parser = subparsers.add_parser("complete", help="Mark todo as completed")
    complete_parser.add_argument("id", type=int, help="Todo ID")

    # Delete command
    delete_parser = subparsers.add_parser("delete", help="Delete a todo")
    delete_parser.add_argument("id", type=int, help="Todo ID")

    # Stats command
    subparsers.add_parser("stats", help="Show statistics")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize PostHog
    posthog = initialize_posthog()

    try:
        # Route to appropriate command
        if args.command == "add":
            cmd_add(args, posthog)
        elif args.command == "list":
            cmd_list(args, posthog)
        elif args.command == "complete":
            cmd_complete(args, posthog)
        elif args.command == "delete":
            cmd_delete(args, posthog)
        elif args.command == "stats":
            cmd_stats(args, posthog)

    except Exception as e:
        print(f"ERROR: {e}")

        # Manually capture handled errors
        if posthog:
            with new_context():
                identify_context(get_user_id())
                posthog.capture_exception(e, get_user_id())

        sys.exit(1)

    finally:
        # IMPORTANT: Always shutdown PostHog to flush events
        if posthog:
            posthog.shutdown()


if __name__ == "__main__":
    main()
