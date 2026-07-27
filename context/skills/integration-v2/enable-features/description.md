# Enable the PostHog products

The SDK is in and initialized. These are the project-level switches that decide
whether the data it sends is actually collected — a flip in PostHog, not a change
in the repo.

{{> enable-products}}

## You don't touch code

The init step of this run owns the client's init options, so the contradicting
options above are already its business, not yours. If you find one that cancels a
flip you just made, name the file and the option in your handoff — review fixes it.
Never edit the repo from here.

## Reading the product signals

The `product-signals` step read the repo for evidence about each product, and you are
queued behind it, so its handoff is already in your context as one line per product. If
it somehow isn't, call `read_handoffs({ type: 'product-signals' })` once — then enable
the products anyway and say in your handoff that you worked without signals. Never wait
and never poll.

Where the signals mark a product `partial`, PostHog would overlap something the
project already runs (an existing error reporter, a logger already shipping
elsewhere). Still enable it — overlap is the user's call to make, not yours — but
name the overlap and the file it came from in your handoff so the report can offer
the user the choice.
