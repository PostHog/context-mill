defmodule PostHogExampleWeb do
  @moduledoc """
  Entry points for the web layer: controllers, HTML views, and the router.

  Use it with `use PostHogExampleWeb, :controller`, `use PostHogExampleWeb, :html`,
  or `use PostHogExampleWeb, :router`.
  """

  def router do
    quote do
      use Phoenix.Router, helpers: false

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def controller do
    quote do
      use Phoenix.Controller,
        formats: [:html],
        layouts: [html: PostHogExampleWeb.Layouts]

      import Plug.Conn
      unquote(verified_routes())
    end
  end

  def html do
    quote do
      use Phoenix.Component

      import Phoenix.Controller, only: [get_csrf_token: 0]
      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: PostHogExampleWeb.Endpoint,
        router: PostHogExampleWeb.Router
    end
  end

  @doc """
  Dispatches to the appropriate helper (controller / html / router / ...).
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
