---
layout: post
title: "Introducing the Open Source Maintenance Fee for Polly"
author: Joel Hulen
date: 2026-07-14
---

![Polly and OSMF](/assets/images/2026/07/polly+osmf.png)

For over a decade, Polly has helped .NET developers build resilient applications through strategies like Retry, Circuit Breaker, Hedging, Timeout, Rate Limiter, and Fallback. Today Polly is used by teams around the world, with more than 14,000 stars on GitHub and over 2 billion downloads across its packages on NuGet.org.

That reach is something we're proud of. It also comes with a cost that isn't always visible: the ongoing work of keeping the project healthy. Today we're announcing that Polly is adopting the [Open Source Maintenance Fee](https://opensourcemaintenancefee.org) (OSMF), and we want to explain what that means, why we're doing it, and what it changes (spoiler: for most people, nothing).

## The part people don't see

Writing the library was the fun part. Keeping it alive is the ongoing part. Behind every release is a steady stream of work that never really ends: triaging issues, answering questions, reviewing pull requests, updating dependencies, tracking and responding to security reports, renewing signing certificates, keeping build and CI pipelines green, dealing with spam in our discussion forums, and publishing new releases.

None of that is glamorous, and none of it is free. It takes real time and sustained attention from real people. That work is what lets you depend on Polly in production with confidence.

## What the Open Source Maintenance Fee is

The [Open Source Maintenance Fee](https://opensourcemaintenancefee.org) is a simple, sensible idea: the source code stays free and open, but organizations that rely on the project's maintained releases to generate revenue help fund the people maintaining it.

A few things are worth being clear about, because the OSMF is often misunderstood:

- **The source code remains free and open.** Polly stays under its existing open source license. Nothing about your right to read, fork, build from, and contribute to the source changes.
- **It is not a license fee and not a support contract.** Paying the fee doesn't buy you an SLA, guaranteed bug fixes, or priority support. It funds the general upkeep that keeps the project running for everyone.
- **It's a small, predictable cost** that creates a direct feedback loop between the organizations that benefit from Polly and the people who keep it maintained.

You can read more about the philosophy behind it on the [OSMF website](https://opensourcemaintenancefee.org).

## How this applies to Polly

Here's the specific arrangement for Polly.

The Maintenance Fee is **US $20 per month** and applies to any company that earns at least **US $20,000** from at least one product or project that uses Polly.

Two details that we're often asked about:

- **It's per organization, not per project.** If you have ten products that use Polly, you pay the fee once. It doesn't matter how many of your projects depend on the library.
- **It's tied to revenue, not to whether your product is paid.** If a product that uses Polly is offered for free but still generates revenue for your organization (through advertising, paid services, lead generation, and so on), the fee applies.

If your organization is below the revenue threshold, an individual, a hobbyist, a student, or a nonprofit not generating revenue from Polly, **you owe nothing**. Polly remains free for you exactly as it is today.

## What is *not* changing

We want to be emphatic about this, because announcements like this one understandably make people nervous:

- Polly's license is **not** changing.
- The source code is **not** moving behind a paywall.
- Free users, contributors, and small projects are **not** being asked to pay.
- Your existing installations will **not** stop working.

The library you rely on stays exactly where it is. What we're adding is a way for the companies that profit from Polly to help sustain it.

## When this takes effect

We believe in giving our community plenty of time to review this, ask questions, and plan accordingly. So we're announcing this now, but we will not begin requesting payment from qualifying companies until **November 12, 2026**, roughly four months from today.

Between now and then, nothing is required of anyone. We'll use this window to answer questions, refine the details, and make the process of paying as painless as possible for the organizations it applies to.

## How to pay when the time comes

When enforcement begins, qualifying organizations will be able to pay the Maintenance Fee through GitHub Sponsors. We'll publish the exact sponsorship tier and step-by-step instructions in our README and in a follow-up post well before the November date, so there will be a clear, simple path to becoming a supporter.

## Why we're asking

Polly is a member of the [.NET Foundation](https://www.dotnetfoundation.org/) and has been generously supported by sponsors including the .NET on AWS Open Source Software Fund, Microsoft's Free and Open Source Software Fund, and GitHub's Secure Open Source Fund. We're grateful for that support, and it has made a real difference.

But grants and donations, by their nature, are unpredictable. They're wonderful when they arrive, but you can't build a maintenance roadmap around a bonus that may or may not come next year. The Maintenance Fee gives us something different: a steady, dependable foundation that lets us plan, keep the project secure and current, and continue serving the community that depends on Polly.

If your organization relies on Polly to help run its business, this is a direct and meaningful way to keep the project you depend on healthy for years to come.

## Questions and feedback

We know a change like this raises questions, and we want to hear them. Please share your thoughts and ask anything in our [GitHub Discussions](https://github.com/App-vNext/Polly/discussions), and take a look at the [OSMF FAQ](https://opensourcemaintenancefee.org/consumers/faq/), which answers many common questions in detail.

Thank you for being part of the Polly community. We're looking forward to keeping the project strong, together.

The Polly Team
