defmodule PostHogExampleWeb.Layouts do
  @moduledoc "The root layout wrapping every page."
  use PostHogExampleWeb, :html

  # The app layout wraps each page's content and is itself wrapped by root/1.
  # Controllers apply it by default (see the `layouts:` option in
  # posthog_example_web.ex); without it every render fails with
  # "no app html template defined".
  def app(assigns) do
    ~H"""
    {@inner_content}
    """
  end

  def root(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>PostHog Elixir example</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }
          nav a { margin-right: 1rem; }
          .flag-on { color: #2e7d32; } .flag-off { color: #999; }
        </style>
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/burrito">Burrito</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/profile">Profile</a>
        </nav>
        <hr />
        <%= @inner_content %>
      </body>
    </html>
    """
  end
end
