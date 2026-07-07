# Recover thepollyproject.org from Wayback Machine → Jekyll on GitHub Pages

## Background

`thepollyproject.org` was hosted on an Azure account that was shut down; all content
was lost. A snapshot survives on the Wayback Machine
(https://web.archive.org/web/20250224010614/https://www.thepollyproject.org/).
Goal: recover the content into Markdown and rebuild as a Jekyll site hosted for
free on GitHub Pages, under the App-vNext GitHub org, with the custom domain
`thepollyproject.org` restored.

## Content inventory (confirmed by crawling the archive)

The old site had exactly two nav items — **Home** (paginated post feed) and
**About** — plus 16 blog posts, no other sections (no docs; Polly's technical docs
live in the GitHub repo, not this blog):

| Date | Title | Author |
|---|---|---|
| 2016-09-29 | Keeping you up to date on Polly | Joel Hulen |
| 2016-10-25 | Polly 5.0 - a wider resilience framework! | Dylan Reisenberger |
| 2016-10-25 | Polly joins the .NET Foundation | Joel Hulen |
| 2017-04-17 | Polly podcast with Bryan Hogan | Dylan Reisenberger |
| 2017-05-04 | Using Execution Context in Polly | Dylan Reisenberger |
| 2017-06-07 | Why does Polly offer both non-generic and generic policies? | Dylan Reisenberger |
| 2017-06-11 | Debugging with Polly in Visual Studio | Dylan Reisenberger |
| 2018-03-06 | Policy recommendations for Azure Cognitive Services | Joel Hulen |
| 2019-02-13 | Introducing custom Polly policies and Polly.Contrib (Custom policies Part I) | Dylan Reisenberger |
| 2019-02-13 | Authoring a proactive Polly policy (Custom policies Part II) | Dylan Reisenberger |
| 2019-02-13 | Authoring a reactive Polly policy (Custom policies Part III) | Dylan Reisenberger |
| 2019-02-13 | Custom policies for all execution types (Custom policies Part IV) | Dylan Reisenberger |
| 2019-06-27 | Simmy, the monkey for making chaos | Geovanny Alzate Sandoval |
| 2019-08-13 | Simmy and Azure App Configuration | Geovanny Alzate Sandoval |
| 2023-03-03 | We want your feedback! Introducing Polly v8 | Joel Hulen |
| 2023-09-28 | Polly v8 officially released | Joel Hulen |

Plus the **About** page.

Two content wrinkles discovered during crawling that the recovery script must
handle:

1. **~45 image references** (many are the shared avatar/logo, reused across
   posts) live under `/content/images/...` on the dead domain. They must be
   pulled from Wayback's image snapshots (`im_` URLs), not the live domain.
2. **22 code samples are embedded as GitHub Gists** (`<script
   src="https://gist.github.com/reisenberger/<id>.js">`), concentrated in the
   "Custom policies" series (Parts II–IV). The archived HTML doesn't contain the
   code — the browser fetched it live via that script tag, so Wayback only
   captured the empty `<script>` tag. Confirmed these gists are **still live**
   on github.com (independent of the dead Azure host), so the recovery script
   fetches each gist's raw content directly from GitHub and inlines it as a
   fenced code block.

## Recovery pipeline

A one-off Python script (not committed to the site repo — a throwaway migration
tool) that, for each of the 16 posts + About page:

1. Fetches the archived HTML (URLs and snapshot timestamps already resolved
   during design research).
2. Parses `h2.post-title`, `span.author`, `span.date`, and the `div.post-content`
   body with BeautifulSoup.
3. Converts the body HTML to Markdown, preserving headings, links, blockquotes,
   and inline `<code>`.
4. Replaces each Gist `<script>` embed with a fetch of
   `https://gist.github.com/<user>/<id>.json` (or raw file URLs) and inlines the
   content as a fenced code block, language inferred from the gist's filename
   extension.
5. Downloads every referenced image via its Wayback `im_` snapshot into
   `assets/images/<year>/<month>/<filename>` in the new repo, rewriting the
   Markdown image link to the local path.
6. Writes `_posts/YYYY-MM-DD-slug.md` with YAML front matter (`title`, `author`,
   `date`, `tags` if present) and the converted body. About page becomes
   `about.md`.
7. If an image snapshot or gist fetch fails, the script does **not** silently
   drop it — it inserts an `<!-- TODO: recover manually — <original url> -->`
   marker in the Markdown so nothing is lost quietly.

## Site scaffold

- Plain Jekyll site using the **Minima** theme (GitHub Pages' own supported
  theme list — no GitHub Actions build workflow required, Pages builds it
  natively on push).
- `_config.yml` with site title/description, author defaults.
- `CNAME` file containing `thepollyproject.org` (DNS still needs to be pointed
  at GitHub Pages by the user — out of scope for me to change).
- A small override of the post layout to embed **giscus** (backed by GitHub
  Discussions on this new repo) below each post — replaces the old Disqus
  threads, which are not recoverable/relevant since they were tied to a
  now-dead domain.
- Off-the-shelf Minima look — no attempt to pixel-match the old Bootstrap/Ghost
  theme.

## Repo & deployment

- New repo under the **App-vNext** GitHub org (I will scaffold the site locally
  in `D:\Dropbox (Personal)\Projects\AppvNext\thepollyproject.org` — already
  git-initialized — and the user creates/pushes the actual GitHub repo, since
  creating a repo under a shared org is a user action, not something to do
  unprompted).
- GitHub Pages source: the default branch, built by Jekyll automatically.
- Custom domain configured via the `CNAME` file; user updates DNS records
  separately.

## Local verification

Ruby/Jekyll (and Docker) are not currently installed on this machine. Per the
user's choice, I will install Ruby (via winget) and Jekyll (via gem) so
`jekyll serve` can be run locally and the rebuilt site previewed in a browser
before anything is pushed to GitHub.

## Out of scope

- Reclaiming/porting Disqus comment history (dropped in favor of giscus).
- Replicating the old site's visual theme pixel-for-pixel.
- Any docs/wiki content — this project only concerns the blog + About page.
