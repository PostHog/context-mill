defmodule PostHogExample.MixProject do
  use Mix.Project

  def project do
    [
      app: :posthog_example,
      version: "0.1.0",
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  # Run "mix help compile.app" to learn about applications.
  def application do
    [
      mod: {PostHogExample.Application, []},
      extra_applications: [:logger]
    ]
  end

  defp elixirc_paths(_), do: ["lib"]

  # Run "mix help deps" to learn about dependencies.
  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:phoenix_html, "~> 4.0"},
      # Phoenix.Component / the ~H sigil used by the HTML views ships in
      # phoenix_live_view, even though this app does not use LiveView itself.
      {:phoenix_live_view, "~> 1.0"},
      {:bandit, "~> 1.5"},
      {:jason, "~> 1.4"},
      # The PostHog server-side SDK. https://posthog.com/docs/libraries/elixir
      {:posthog, "~> 2.0"}
    ]
  end
end
