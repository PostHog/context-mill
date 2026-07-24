defmodule PostHogExampleWeb.BurritoHTML do
  @moduledoc "Tiny HEEx pages for the burrito app."
  use PostHogExampleWeb, :html

  def home(assigns) do
    ~H"""
    <h1>🌯 Burrito app</h1>
    <p>Signed in as: <strong><%= @distinct_id %></strong></p>
    <form method="post" action="/login">
      <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
      <label>Username <input type="text" name="username" value="burrito_fan" /></label>
      <button type="submit">Log in</button>
    </form>
    """
  end

  def burrito(assigns) do
    ~H"""
    <h1>Consider a burrito</h1>
    <p>You have considered a burrito <strong><%= @count %></strong> time(s).</p>
    <form method="post" action="/burrito">
      <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
      <button type="submit">Consider a burrito</button>
    </form>
    """
  end

  def dashboard(assigns) do
    ~H"""
    <h1>Dashboard</h1>
    <p :if={@show_new_feature} class="flag-on">
      ✨ The <code>new-dashboard-feature</code> flag is <strong>ON</strong>.
    </p>
    <p :if={!@show_new_feature} class="flag-off">
      The <code>new-dashboard-feature</code> flag is off (default).
    </p>
    """
  end

  def profile(assigns) do
    ~H"""
    <h1>Profile</h1>
    <p>Distinct id: <strong><%= @distinct_id %></strong></p>
    <p :if={@message}><em><%= @message %></em></p>
    <form method="post" action="/profile/error">
      <input type="hidden" name="_csrf_token" value={get_csrf_token()} />
      <button type="submit">Trigger an error</button>
    </form>
    <p><a href="/logout">Log out</a></p>
    """
  end
end
