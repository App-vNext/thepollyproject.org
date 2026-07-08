# thepollyproject.org

Source for the Polly project blog, rebuilt as a Jekyll site after the
original Azure-hosted site was lost. Content was recovered from the
[Wayback Machine snapshot](https://web.archive.org/web/20250224010614/https://www.thepollyproject.org/)
— see `docs/superpowers/specs/2026-07-07-recover-polly-blog-design.md` for
details on what was recovered and how.

## Local development

```
bundle install
bundle exec jekyll serve
```

Then open http://127.0.0.1:4000/.

## Deploying

1. Create a new repo under the App-vNext GitHub org (e.g.
   `App-vNext/thepollyproject.org`) and push this directory to its default
   branch.
2. In the repo's Settings → Pages, set the source to the default branch
   (root). GitHub Pages will build it automatically via Jekyll — no Actions
   workflow needed.
3. In Settings → Pages → Custom domain, enter `thepollyproject.org` (the
   `CNAME` file already sets this, but GitHub needs it configured on the repo
   too so it provisions HTTPS).
4. At your DNS provider, point `thepollyproject.org` at GitHub Pages: an
   `ALIAS`/`ANAME` (or `A` records to GitHub's documented Pages IPs) for the
   apex domain, matching [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
5. Enable **Discussions** on the new repo (Settings → General → Features →
   Discussions), then create a "Comments" discussion category.
6. Go to https://giscus.app, fill in the repo name, and copy the generated
   `data-repo-id` and `data-category-id` values into
   `_includes/giscus.html`, replacing `REPLACE_WITH_REPO_ID` and
   `REPLACE_WITH_CATEGORY_ID`. Commit and push.
