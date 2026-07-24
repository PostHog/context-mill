defmodule PostHogExampleWeb.ErrorHTML do
  @moduledoc "Renders plain-text status pages for errors (e.g. 404, 500)."
  use PostHogExampleWeb, :html

  # e.g. render("404.html", _) -> "Not Found"
  def render(template, _assigns) do
    Phoenix.Controller.status_message_from_template(template)
  end
end
