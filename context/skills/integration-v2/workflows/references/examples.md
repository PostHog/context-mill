---
title: Example proposals
description: Two complete proposals for a sample note-taking app
---

# Example proposals

These are for a sample app, a shared note-taking tool. Its event plan has
`user_signed_up`, `notebook_created`, and `subscription_canceled`, and identify
sets `email` and `first_name` on the person. Use them for shape and tone. Do
not copy their events or words: design for the app in front of you.

## A welcome with an onboarding nudge

The user signs up and gets a welcome. If they create no notebook within three
days, they get one reminder. A user who creates a notebook leaves the workflow.

```json
{
  "title": "Welcome and first notebook nudge",
  "reason": "Welcomes each user after user_signed_up, and reminds anyone with no notebook_created after 3 days.",
  "workflow": {
    "name": "Welcome and first notebook nudge (wizard)",
    "description": "Welcome email on sign-up, then one reminder if no notebook is created within 3 days.",
    "exit_condition": "exit_on_conversion",
    "conversion": {
      "events": [{ "filters": { "events": [{ "id": "notebook_created", "name": "notebook_created", "type": "events" }] } }],
      "filters": [],
      "window": "14d"
    },
    "actions": [
      {
        "id": "trigger_node",
        "name": "User signed up",
        "description": "",
        "type": "trigger",
        "config": {
          "type": "event",
          "filters": { "events": [{ "id": "user_signed_up", "name": "user_signed_up", "type": "events", "order": 0 }] }
        }
      },
      {
        "id": "email_welcome",
        "name": "Welcome email",
        "description": "",
        "type": "function_email",
        "config": {
          "template_id": "template-email",
          "inputs": {
            "email": {
              "value": {
                "to": { "email": "{{ person.properties.email }}", "name": "" },
                "from": { "email": "", "name": "" },
                "subject": "Welcome to Notely",
                "text": "Hi {{ person.properties.first_name | default: \"there\" }},\n\nThanks for signing up. The best way to start is to create your first notebook and invite one teammate.\n\nCreate a notebook: https://app.notely.example.com/notebooks/new\n\nThe Notely team"
              }
            }
          }
        }
      },
      {
        "id": "wait_notebook",
        "name": "Wait for first notebook",
        "description": "",
        "type": "wait_until_condition",
        "config": {
          "events": [{ "filters": { "events": [{ "id": "notebook_created", "name": "notebook_created", "type": "events" }] }, "name": "Created a notebook" }],
          "max_wait_duration": "3d"
        }
      },
      {
        "id": "email_reminder",
        "name": "Reminder email",
        "description": "",
        "type": "function_email",
        "config": {
          "template_id": "template-email",
          "inputs": {
            "email": {
              "value": {
                "to": { "email": "{{ person.properties.email }}", "name": "" },
                "from": { "email": "", "name": "" },
                "subject": "Your first notebook takes a minute",
                "text": "Hi {{ person.properties.first_name | default: \"there\" }},\n\nYou have not created a notebook yet. Start with a blank one, or paste notes you already have.\n\nCreate a notebook: https://app.notely.example.com/notebooks/new\n\nThe Notely team"
              }
            }
          }
        }
      },
      { "id": "exit_node", "name": "Exit", "description": "", "type": "exit", "config": { "reason": "Done" } }
    ],
    "edges": [
      { "from": "trigger_node", "to": "email_welcome", "type": "continue" },
      { "from": "email_welcome", "to": "wait_notebook", "type": "continue" },
      { "from": "wait_notebook", "to": "exit_node", "type": "branch", "index": 0 },
      { "from": "wait_notebook", "to": "email_reminder", "type": "continue" },
      { "from": "email_reminder", "to": "exit_node", "type": "continue" }
    ]
  }
}
```

## One question after a cancellation

The user cancels and, an hour later, gets one short email that asks why. The
masking makes sure a user who cancels twice in a month gets it once.

```json
{
  "title": "Ask why after a cancellation",
  "reason": "Sends one short question an hour after subscription_canceled, to learn why users leave.",
  "workflow": {
    "name": "Ask why after a cancellation (wizard)",
    "description": "One email an hour after a cancellation that asks what made the user leave.",
    "exit_condition": "exit_only_at_end",
    "trigger_masking": { "hash": "{person.id}", "ttl": 2592000 },
    "actions": [
      {
        "id": "trigger_node",
        "name": "Subscription canceled",
        "description": "",
        "type": "trigger",
        "config": {
          "type": "event",
          "filters": { "events": [{ "id": "subscription_canceled", "name": "subscription_canceled", "type": "events", "order": 0 }] }
        }
      },
      { "id": "delay_1h", "name": "Wait 1 hour", "description": "", "type": "delay", "config": { "delay_duration": "1h" } },
      {
        "id": "email_why",
        "name": "Ask why",
        "description": "",
        "type": "function_email",
        "config": {
          "template_id": "template-email",
          "inputs": {
            "email": {
              "value": {
                "to": { "email": "{{ person.properties.email }}", "name": "" },
                "from": { "email": "", "name": "" },
                "subject": "One question about Notely",
                "text": "Hi {{ person.properties.first_name | default: \"there\" }},\n\nYour subscription is canceled. If you have a minute, reply and tell us what made you leave. We read every answer.\n\nThe Notely team"
              }
            }
          }
        }
      },
      { "id": "exit_node", "name": "Exit", "description": "", "type": "exit", "config": { "reason": "Done" } }
    ],
    "edges": [
      { "from": "trigger_node", "to": "delay_1h", "type": "continue" },
      { "from": "delay_1h", "to": "email_why", "type": "continue" },
      { "from": "email_why", "to": "exit_node", "type": "continue" }
    ]
  }
}
```
