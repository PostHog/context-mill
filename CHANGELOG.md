# Changelog

## [1.51.1](https://github.com/PostHog/context-mill/compare/v1.51.0...v1.51.1) (2026-09-04)


### Bug Fixes

* **integration:** initialize snippets with read-only toString ([#382](https://github.com/PostHog/context-mill/issues/382)) ([6149f9d](https://github.com/PostHog/context-mill/commit/6149f9d654affa4bf5ce5d1f716e003295a53d9e))
* **self-driving:** scout-gate source is on by default — align step 4 with the inbox-source-configs-create contract ([#369](https://github.com/PostHog/context-mill/issues/369)) ([706a8d3](https://github.com/PostHog/context-mill/commit/706a8d3ca73465b293c1c2ef61e82acfa17790dc))

## [1.51.0](https://github.com/PostHog/context-mill/compare/v1.50.0...v1.51.0) (2026-09-03)


### Features

* add google-adk variant to ai-observability skill ([c21ab41](https://github.com/PostHog/context-mill/commit/c21ab41ddc294ef54c8b73f2d223c3c86a5d1422))
* **skills:** route Go projects to the OpenTelemetry AIO variant ([61565ef](https://github.com/PostHog/context-mill/commit/61565efd755368181a20e553c29388ee294bdf4a))

## [1.50.0](https://github.com/PostHog/context-mill/compare/v1.49.1...v1.50.0) (2026-09-01)


### Features

* **self-driving:** drop the in-run GitHub gate ([6156694](https://github.com/PostHog/context-mill/commit/61566946bd430c9003766aadb06d104dd899a0af))
* **self-driving:** drop the in-run GitHub gate ([d0a0e61](https://github.com/PostHog/context-mill/commit/d0a0e610e5c2b85478ccf340928841da00476046))
* **skills:** add instrument-metrics skill family ([6cd6522](https://github.com/PostHog/context-mill/commit/6cd65228d9a8049a29e43c96c0a3a7cbbbcae220))
* **skills:** give the omnibus skill the full metrics doc set ([c47432c](https://github.com/PostHog/context-mill/commit/c47432c4f0c976d0ee7dd9bbcb721f2d05ededf2))
* **wizard-ci:** let a PR comment pin the wizard ref ([6d791cf](https://github.com/PostHog/context-mill/commit/6d791cfa6570b6b190d5df18d64fdd2de3171fdc))
* **wizard-ci:** let a PR comment pin the wizard ref ([a4aa53e](https://github.com/PostHog/context-mill/commit/a4aa53e596beb288efbff3cc851c2ccf2ab56fd6))


### Bug Fixes

* **skills:** pin dependency installs to latest, write one credential set ([#368](https://github.com/PostHog/context-mill/issues/368)) ([59ca667](https://github.com/PostHog/context-mill/commit/59ca66799cf4a2856ac5edf3b65f1ee2131a95cf))
* **skills:** stop self-driving enabling the retired replay source ([a528e96](https://github.com/PostHog/context-mill/commit/a528e968ca6b58352e2556e5114a386d3156b69b))
* **skills:** stop self-driving enabling the retired replay source ([4eadd62](https://github.com/PostHog/context-mill/commit/4eadd62e069a1c8513346b42649f99ae11f0281d))

## [1.49.1](https://github.com/PostHog/context-mill/compare/v1.49.0...v1.49.1) (2026-08-26)


### Bug Fixes

* **build:** skip .nuxt, .output, and sourcemaps in example processing ([4c106ec](https://github.com/PostHog/context-mill/commit/4c106ec69552c15b7c50df36b07b5bf462ac936c))
* **build:** skip .nuxt, .output, and sourcemaps in example processing ([b5166e7](https://github.com/PostHog/context-mill/commit/b5166e7daee188704e877f45106731efb37a177d))
* **data-warehouse-source:** tell the agent to scan every .env file ([163fade](https://github.com/PostHog/context-mill/commit/163fadec3bb82a134ce72cfa88c15f5207fc344f))
* **data-warehouse-source:** tell the agent to scan every .env file ([e7fb5ce](https://github.com/PostHog/context-mill/commit/e7fb5ce2a0418648d5a84b4c8ca6f3cc0dc1d205))
* **integration-v2-warehouse:** port the check_env_keys project-wide scan guidance ([83b0e87](https://github.com/PostHog/context-mill/commit/83b0e8751569bcb4e5e22d4d4efe19db63230f62))
* **warehouse-skills:** point Supabase at its own source type, not Postgres ([0d0c938](https://github.com/PostHog/context-mill/commit/0d0c9381866be8fb4c97aed33af7f21b54120f57))
* **warehouse-skills:** port the env-key fix to the seeded skill, correct Supabase, warn on label vs kind ([3610107](https://github.com/PostHog/context-mill/commit/361010702d6c9a8f8b9ee62d31c4889137072ebe))
* **warehouse-skills:** warn that the label is not a valid source_type ([32e8ce0](https://github.com/PostHog/context-mill/commit/32e8ce05b1d9599cfafa3fd76e309c4f3ae43150))
* **warehouse:** ask once per source, and report what was actually created ([836f7a3](https://github.com/PostHog/context-mill/commit/836f7a301b403e267f8f9cee7a697f6a15e23ac9))
* **warehouse:** ask once per source, and report what was actually created ([d61f300](https://github.com/PostHog/context-mill/commit/d61f3007a78032ac2d530c658fca3897e4af77e0))

## [1.49.0](https://github.com/PostHog/context-mill/compare/v1.48.0...v1.49.0) (2026-08-24)


### Features

* **build:** variants declare the frameworks they serve — one menu entry per framework ([e9b0aca](https://github.com/PostHog/context-mill/commit/e9b0aca89f11fcad91b4943f4d3b1a5d6c40294b))
* **integration:** add Java (Spring Boot) as a full example-based variant ([#270](https://github.com/PostHog/context-mill/issues/270)) ([7ab67b4](https://github.com/PostHog/context-mill/commit/7ab67b4af60a8e769ffc349fc7b768e1e7cd47f0))
* **integration:** add Rust as a full example-based variant ([#269](https://github.com/PostHog/context-mill/issues/269)) ([716684b](https://github.com/PostHog/context-mill/commit/716684bcaad849baa101d140081e2657761a3dcb))
* **integration:** make Elixir a full example-based variant ([#268](https://github.com/PostHog/context-mill/issues/268)) ([86619ad](https://github.com/PostHog/context-mill/commit/86619ad9a84441a1f1eec20abdb01e96ca431644))
* **integration:** make Go a full example-based variant ([#267](https://github.com/PostHog/context-mill/issues/267)) ([d2896b8](https://github.com/PostHog/context-mill/commit/d2896b89aefdd294ee7c39210eeb0863ae0c08f4))
* **mcp-analytics:** detect and instrument MCP TypeScript SDK v2 servers ([c27f00a](https://github.com/PostHog/context-mill/commit/c27f00a767b49c23dd60ae2171729882c6c7ec82))
* **metrics:** orchestrator flow — verify the SDK before instrumenting ([3dca124](https://github.com/PostHog/context-mill/commit/3dca1245bc56ca389b0aec92498622d08d7cf129))
* **metrics:** orchestrator flow — verify the SDK before instrumenting ([3545b0f](https://github.com/PostHog/context-mill/commit/3545b0f9c2aa007dd27ba752f605ef5cf2e09955))
* **metrics:** seed fans out one verify→instrument chain per service — monorepo-aware, parallel chains ([223b229](https://github.com/PostHog/context-mill/commit/223b229e07bcca85f6533a2ce37b853f9726dc5e))
* **metrics:** seed picks the skill variant and hands it to tasks as input ([50b9342](https://github.com/PostHog/context-mill/commit/50b93426dfa8401deec55fc9be8d4373f1e67bf1))
* **skills:** add metrics skill family (posthog.metrics) ([f57b7d9](https://github.com/PostHog/context-mill/commit/f57b7d9b95e101d4e263054ae8277fd924983b11))


### Bug Fixes

* **integration-v2:** make step prose platform-aware instead of web-shaped ([9f35f18](https://github.com/PostHog/context-mill/commit/9f35f182c18aa932e32df5d12658c141f5b7f089))
* **metrics:** report mirrors into a PostHog notebook like integration-v2 — no report file ([6bbc198](https://github.com/PostHog/context-mill/commit/6bbc1985396cf21ce296d4363f1ae05fa7925012))
* **metrics:** report task writes posthog-metrics-report.md like replay-vision — outro has a file to show ([bdd2a5e](https://github.com/PostHog/context-mill/commit/bdd2a5ee168ee244d207e54185926405c3c52f39))
* **metrics:** seed manifest sweep is mechanical — one find per pattern, every ecosystem ([956bbf0](https://github.com/PostHog/context-mill/commit/956bbf0b747bc228bf926e9ac41b2870ebf4c47f))
* **metrics:** seed maps every manifest ecosystem — a python worker inside an npm workspace gets its chain ([45388be](https://github.com/PostHog/context-mill/commit/45388be67c703d45701707e5c3e56c7c273b939d))
* **metrics:** tasks declare the metrics skill — the seed's pick pins the variant, not an install_skill call ([5e06f15](https://github.com/PostHog/context-mill/commit/5e06f1588290b128a2687188065215a4fdea224d))
* **metrics:** verify-sdk at sol-medium, report on luna like the integration report ([cb931da](https://github.com/PostHog/context-mill/commit/cb931da6da838c3a06104ca12d0046bfcd081cbd))
* **notebooks:** sweep dead notebook tool names for the live markdown-native API ([1fd70df](https://github.com/PostHog/context-mill/commit/1fd70dfe7a9f21be3d78b7459175cfa21ac1b3eb))
* **rust:** flush and shutdown are unconditional, not gated on an existing shutdown path ([fe6959d](https://github.com/PostHog/context-mill/commit/fe6959d9e520580c5ff92f0fc31fc2918d0773f8))
* **rust:** flush and shutdown are unconditional, not gated on an existing shutdown path ([47a0db5](https://github.com/PostHog/context-mill/commit/47a0db5702521e87bc7b9438161e600b478837ed))


### Reverts

* **metrics:** keep the five platform variants — tasks pull the matching one themselves ([9a3e880](https://github.com/PostHog/context-mill/commit/9a3e8805c2aef87eeaca277de750eaf4d4b80adb))

## [1.48.0](https://github.com/PostHog/context-mill/compare/v1.47.0...v1.48.0) (2026-08-20)


### Features

* **replay-vision:** customize the scanner briefs per app and share them with self-driving ([13e63c4](https://github.com/PostHog/context-mill/commit/13e63c4844d806d19ea1956ac2613cc8f18530af))
* **replay-vision:** customize the three scanners per app instead of adding more ([aaa5c44](https://github.com/PostHog/context-mill/commit/aaa5c44fd13e5a2d509d95c6a957788f41ca1ca4))


### Bug Fixes

* allow the report task to write its report file ([37232bf](https://github.com/PostHog/context-mill/commit/37232bf667fc5b75e529f7e1baf73184c5d1233a))
* report task writes posthog-replay-vision-report.md like the linear arm ([6dead5f](https://github.com/PostHog/context-mill/commit/6dead5f89bfc4d1c67d1c02c2f75904acccf4726))

## [1.47.0](https://github.com/PostHog/context-mill/compare/v1.46.1...v1.47.0) (2026-08-19)


### Features

* **replay-vision:** orchestrator flow and scanner step-skills ([3f9cd79](https://github.com/PostHog/context-mill/commit/3f9cd79f89ba612de3c96ee89ecb5cef05d10394))
* **skills:** add replay-vision wizard command ([1dcc90e](https://github.com/PostHog/context-mill/commit/1dcc90e5f5e32160a869e783db68e7a88ad8be87))

## [1.46.1](https://github.com/PostHog/context-mill/compare/v1.46.0...v1.46.1) (2026-08-18)


### Bug Fixes

* **integration-v2:** batch warehouse credential asks across sources ([9e5b5c0](https://github.com/PostHog/context-mill/commit/9e5b5c0c56a8e8aebc906ed06f3bdedb5fe52ee3))
* **integration-v2:** batch warehouse credential asks across sources ([e850016](https://github.com/PostHog/context-mill/commit/e85001655bc9f2da4251c2cfe68f915b4bad84db))
* **integration-v2:** build warehouse deep links from the app host ([56c583a](https://github.com/PostHog/context-mill/commit/56c583a031e300faf7712e1dd6505356afa9be99))
* **integration-v2:** build warehouse deep links from the app host ([bb52957](https://github.com/PostHog/context-mill/commit/bb52957510ff7be8dcada37c79018ad9f43bd59b))
* **integration-v2:** create SaaS sources via the one-step setup tool ([99f36c0](https://github.com/PostHog/context-mill/commit/99f36c0ecf67af08f315d89e36f01d20cf672c72))
* **integration-v2:** create SaaS sources via the one-step setup tool ([bc5bf3d](https://github.com/PostHog/context-mill/commit/bc5bf3d6b585a5cc70a38ea6c91cedbefe84a6ff))
* **integration-v2:** scope warehouse discovery to the user's schema ([11d8f99](https://github.com/PostHog/context-mill/commit/11d8f991f264aab9c649fcab52752d317036e299))
* **integration-v2:** scope warehouse discovery to the user's schema ([ef05ea7](https://github.com/PostHog/context-mill/commit/ef05ea74e0913d1bbcb435700525e816f3b7a99a))

## [1.46.0](https://github.com/PostHog/context-mill/compare/v1.45.0...v1.46.0) (2026-08-12)


### Features

* **integration-v2:** warehouse agent and skill for the orchestrator's optional data-source task ([fdc7872](https://github.com/PostHog/context-mill/commit/fdc787245f4fa9f7bf862f56e72aaba026139323))
* **integration-v2:** warehouse agent, skill, and sink guard for runner-seeded tasks ([8dbb1df](https://github.com/PostHog/context-mill/commit/8dbb1dfd9b8620f613956d36cc1d9b91b8a4998d))

## [1.45.0](https://github.com/PostHog/context-mill/compare/v1.44.0...v1.45.0) (2026-08-07)


### Features

* declare desktop skill distribution in the manifest ([9b953db](https://github.com/PostHog/context-mill/commit/9b953db8bd8033ade7f80deca3c7dc6f692e5082))


### Bug Fixes

* expose product tours skill across consumers ([8c7f435](https://github.com/PostHog/context-mill/commit/8c7f4352b09663cbfbd8a491653e75abc1de86c6))
* expose product tours skill across consumers ([284348e](https://github.com/PostHog/context-mill/commit/284348ecef79cbfbd8d50430bc0eb39297dbad81))


### Reverts

* remove desktop distribution metadata ([7b43e56](https://github.com/PostHog/context-mill/commit/7b43e567b03e273b4bdd73f7d8028f2eaaca6a39))

## [1.44.0](https://github.com/PostHog/context-mill/compare/v1.43.1...v1.44.0) (2026-08-06)


### Features

* **audit:** read PostHog's live data as a step in the comprehensive audit ([be14887](https://github.com/PostHog/context-mill/commit/be148870a66e913c05c58c61007dfbc5062786bf))
* **audit:** read PostHog's live data as a step in the comprehensive audit ([19ea34e](https://github.com/PostHog/context-mill/commit/19ea34eb6a7945a9a1d6ac73160d28b4203c28c1))
* **self-driving:** Replay Vision scanners as step 6c ([#313](https://github.com/PostHog/context-mill/issues/313)) ([56ade12](https://github.com/PostHog/context-mill/commit/56ade125205ae05a544793a70e0fcbf0f82324f5))

## [1.43.1](https://github.com/PostHog/context-mill/compare/v1.43.0...v1.43.1) (2026-08-05)


### Bug Fixes

* **ai-observability:** keep .env.example out of .gitignore ([454f5f1](https://github.com/PostHog/context-mill/commit/454f5f1bbfb2e203eda035e282344c85cf52b55a))
* **ai-observability:** keep .env.example out of .gitignore ([a8c1d54](https://github.com/PostHog/context-mill/commit/a8c1d54e8eab531ef5955b8f2913e59ff31909df))

## [1.43.0](https://github.com/PostHog/context-mill/compare/v1.42.1...v1.43.0) (2026-08-05)


### Features

* **ai-observability:** rebuild the skill around the SDK wrapper and the session tree ([3b0d5ba](https://github.com/PostHog/context-mill/commit/3b0d5ba5b599353ce384cfc9a7e5bf196a58aa7b))


### Bug Fixes

* **ci:** address review of the signed-commit swap ([e234269](https://github.com/PostHog/context-mill/commit/e234269c672fa98956e90bda2afe92c7af5f860a))
* **ci:** sign the commits this workflow creates ([329044a](https://github.com/PostHog/context-mill/commit/329044ad844237e3389d3287187561865b942df1))
* **ci:** sign the commits this workflow creates ([0cb32fe](https://github.com/PostHog/context-mill/commit/0cb32fe87241cd8c9b50f93a57192076aa096cb4))

## [1.42.1](https://github.com/PostHog/context-mill/compare/v1.42.0...v1.42.1) (2026-08-04)


### Bug Fixes

* **wizard:** Whack a mole part 6: move the luna-low tasks to terra-low ([36d795d](https://github.com/PostHog/context-mill/commit/36d795dad3ae50ec30afba504b6a29280e03aaff))

## [1.42.0](https://github.com/PostHog/context-mill/compare/v1.41.0...v1.42.0) (2026-08-04)


### Features

* **integration:** add Flutter burrito example app ([13b226a](https://github.com/PostHog/context-mill/commit/13b226a58e7b4639c0ee17585cfd006f61f7a4f6))


### Bug Fixes

* don't include component in release tag ([b40e047](https://github.com/PostHog/context-mill/commit/b40e0470ef385c828fd2ef63ced91af090a035d1))
* **wizard:** Whack a mole part 4: align init token rule with the commandments' no-env exception ([ff8f38a](https://github.com/PostHog/context-mill/commit/ff8f38a2db2cff0e384c20f5cff16fc503c1970f))
