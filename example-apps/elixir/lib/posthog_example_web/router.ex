defmodule PostHogExampleWeb.Router do
  use PostHogExampleWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :put_root_layout, html: {PostHogExampleWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  scope "/", PostHogExampleWeb do
    pipe_through :browser

    get "/", BurritoController, :home
    post "/login", BurritoController, :login
    get "/logout", BurritoController, :logout

    get "/burrito", BurritoController, :burrito
    post "/burrito", BurritoController, :consider_burrito

    get "/dashboard", BurritoController, :dashboard

    get "/profile", BurritoController, :profile
    post "/profile/error", BurritoController, :trigger_error
  end
end
