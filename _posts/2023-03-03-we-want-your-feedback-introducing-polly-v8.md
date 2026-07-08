---
layout: post
title: "We want your feedback! Introducing Polly v8"
author: Joel Hulen
date: 2023-03-03
---

![We want your feedback! Introducing Polly v8](/assets/images/2023/03/Polly-v8.png)
> **UPDATE: May 26, 2023**
>
> We have issued a new pull request ([Polly V8: Public API Review #1233](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/pull/1233)) to introduce the v8 API to the public. **We would love your feedback!** Help shape the API ahead of a tentative June release.

There is no question that the Polly library has had a big impact on the .NET community in providing useful resilience and transient fault handling policies in an accessible way to [millions of projects](https://web.archive.org/web/20250112235732/https://www.nuget.org/packages/Polly). Given its widespread use and popularity, we are responsible as maintainers for ensuring the library remains relevant, useful, and highly performant. The last thing we want is for you to invest countless hours designing and crafting an application, with painstaking attention to detail and performance and big plans for scaling at a global level, just to be hampered by a dependency that cannot keep up with those high levels of demand.

## What led us here?

Back in 2015, Polly joined the .NET Foundation, which helped us align with Microsoft and the broader .NET community. We wanted to make sure we weren't progressing in a vacuum.

In 2017, we started working with Glenn Condron and Ryan Nowak from the .NET team via an introduction by Jon Galloway to collaborate on extending the brand new `HttpClientFactory` to add Polly as an optional dependency package that lets users easily [add resilience policies to `HTTPClient` requests](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory) beginning with ASP.NET Core 2.1. I believe that being a member of the .NET Foundation led to this collaboration with the .NET team.

In early 2019, we recognized that many community members were working on interesting Polly-adjacent projects that added new capabilities to the core library. We wanted to ensure these projects enjoyed the visibility they deserved while providing a space for contributors to collaborate on these projects. To facilitate and encourage this community engagement, we created [Polly.Contrib](https://web.archive.org/web/20250112235732/https://github.com/orgs/Polly-Contrib/repositories?type=all), out of which many great projects have emerged, from caching, wait-and-retry helper methods, chaos-engineering + fault-injection, and many more. *Be sure to watch this space*. You may see some new repos for extension packages during the transition to the new SDK version.

## The new API

Fast forward to today, we are once again collaborating with the .NET team to release version 8. Immo Landwerth reached out to our team in December 2022 to discuss significant changes and a proposed solution developed by his team. Candidly, there have been minimal significant updates to the Polly library for the past couple of years, despite excellent contributions by our core team members, Martin Costello and Simon Cropp, and several [community members](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/pulls). Meanwhile, the project carries a non-trivial amount of technical debt, including a lack of cancelation tokens in many operations, a lack of full async support for all callbacks (including the circuit breaker), and open performance issues ([#271](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/issues/271), [#845](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/issues/845), and [#955](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/issues/955)). As you can imagine, making significant architectural changes to a popular library carries some risk.

> Polly's resilience strategies should cost next to nothing when your application is healthy and only add some cost when it steps in to handle failures.

To address these issues, the .NET team built a prototype version of Polly that simplifies Polly's API surface area with a single `IResilienceStrategy` interface responsible for executing all Polly scenarios and addresses the performance issues with excellent results. In fact, in early tests, the new changes resulted in reduced CPU overhead by 80%. Additionally, the POC significantly reduced allocations by large factors. All of these gains appear before a concerted effort to optimize the POC.

Here is a snapshot of the performance improvements. You can [view more benchmark results](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/tree/v8-poc/src/Polly.Strategies.Bench) in the `v8-poc` branch:

![v8 vs. v7 performance comparison.](/assets/images/v8-performance.png)

The new functionality will be exposed through a novel foundational API. New or updated applications will be able to take advantage of this new API to achieve the highest level of performance. The existing v7 Polly API will be reimplemented on top of this new API, ensuring compatibility and full interoperability for existing applications.

Martin Tomka, who authored the v8 POC, wrote a [document that explains the changes in more detail](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/blob/v8-poc/docs/Polly-V8.md).

## So, what's the catch?

You might be thinking that all of this sounds promising as a compelling way forward to revitalize Polly and address performance issues and technical debt, but how do we approach this in a way that preserves backward compatibility and allows us to reuse Polly policies from the community? We have discussed this at length with our Microsoft colleagues. In short, we will make our best effort to bridge the capabilities of the new API with the legacy (current) Polly policies. This way, your investments in custom Polly policies can be used in the new design. We aim to minimize disruptions as much as possible. We cannot make any guarantees since there may be edge cases, but that is the beauty of open-source projects; all work is performed in the clear so that you can try early releases in your environment. If you find any issues, let us know, or submit a PR! We believe that by adopting the new API in v8 and using the legacy policies, in the worst case, the performance will be the same as with v7 packages. If you adapt your code to take full advantage of the new API, then you will realize those gains and the simplicity of the new API layer.

## What's next?

We have [created a new GitHub issue](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/issues/1048) for Polly v8. Please use this to raise any issues, concerns, or ideas with the team. As a member of the Polly community, your feedback is very important to us. You can check out the `v8-poc` [branch](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/tree/v8-poc) to review the code in progress and take it for a spin. We have also created a [GitHub project](https://web.archive.org/web/20250112235732/https://github.com/orgs/App-vNext/projects/1/views/1) where we will work in the open by managing tasks associated with our work on the new API. If you want to create new GitHub issues related to v8, please tag it with the [v8 label](https://web.archive.org/web/20250112235732/https://github.com/App-vNext/Polly/labels/v8) for visibility.

Thank you once again for being a valued member of the Polly community. I am excited about our future, and I hope you are too!
