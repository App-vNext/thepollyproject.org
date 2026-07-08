---
layout: post
title: "Polly v8 officially released"
author: Joel Hulen
date: 2023-09-28
---

![Polly v8 officially released](/assets/images/2023/09/Polly-v8.png)

After months of continuous development, Polly v8 is finally here! In our [v8 announcement post](https://web.archive.org/web/20250217232425/https://www.thepollyproject.org/2023/03/03/we-want-your-feedback-introducing-polly-v8/), we discussed the background of the Polly project and what motivated us to completely redesign the library with a hyper-focus on performance. We were very fortunate to have top-notch developers from Microsoft do the bulk of the design and implementation of this release. We could not have finished v8 anywhere close to the time it took if we didn't have their help.

Polly's latest release brings an array of exciting enhancements that will supercharge your resilience strategies and hopefully boost your application's performance and reliability. In this post, we'll discuss key Polly v7 and v8 differences that highlight v8 improvements. So, let’s dive in! 🏊‍♂️

## Introduction to Polly v8

Polly v8 has landed with a bang, bringing major improvements and supporting all the same scenarios as its predecessor but with more speed and flexibility. It has been re-engineered to provide more power and ease of use, ensuring a robust approach to handling your applications' retries, timeouts, and other resilience strategies.

> **Important note:** To use Polly v8, you need to install the new [Polly.Core](https://web.archive.org/web/20250217232425/https://www.nuget.org/packages/Polly.Core/) NuGet package. If you are not ready to transition existing resilience policies to v8, the v7 API is still available and fully supported even when using the v8 version by referencing the [Polly](https://web.archive.org/web/20250217232425/https://www.nuget.org/packages/Polly) package.

One of the significant improvements in v8 is **improved speed** and resource efficiency. With its significant performance enhancements and zero-allocation APIs, it's tailored for advanced and demanding use cases. We now have a [bench](https://web.archive.org/web/20250217232425/https://github.com/App-vNext/Polly/tree/main/bench) folder in the repo that lets you run benchmark tests. We also store the latest benchmark results here so you can view the speed differences within the different strategies.

As we like to say, Polly's resilience strategies should cost next to nothing when your application is healthy and only add some cost when it steps in to handle failures.

### Primary differences 🕵️‍♂️

There were many outstanding issues that we addressed in this version of Polly. Some items, as well as the performance improvements, required a complete refactoring of the framework, which is a daunting proposition when your library has [almost 500 million downloads](https://web.archive.org/web/20250217232425/https://www.nuget.org/packages/Polly/). Because of this refactoring, there are several important differences we'd like to highlight.

#### From policy to strategy

**Policy** is now renamed to [**strategy**](https://web.archive.org/web/20250217232425/https://www.pollydocs.org/strategies/index.html). In the world of Polly v8, we talk about resilience strategies rather than policies for retries, timeouts, and the like.

#### Enter the Resilience Pipelines

Polly v8 introduces the concept of [resilience pipelines](https://web.archive.org/web/20250217232425/https://www.pollydocs.org/pipelines/index.html), a powerful tool that blends one or more resilience strategies. This new API foundation echoes the Policy Wrap of previous versions but is now integrated seamlessly into the core API. All strategies start with a pipeline.

#### Unified sync and async flows

No more juggling between various interfaces. Polly v8 has unified interfaces like `IAsyncPolicy`, `ISyncPolicy`, and others under the banner of `ResiliencePipeline` and `ResiliencePipeline<T>`, effortlessly supporting both synchronous and asynchronous execution flows.

#### Native async support

Polly v8 is designed with native asynchronous support from the get-go, enabling smoother and more efficient async operations.

#### No more static APIs

Say goodbye to static APIs with Polly v8. This change enhances testability and extensibility while preserving simplicity and ease of use.

#### Flexible configuration

Polly v8 adopts an options-based configuration for individual resilience strategies, offering more flexibility and improving maintainability and extensibility.

#### Telemetry at your fingertips

[Built-in telemetry support](https://web.archive.org/web/20250217232425/https://www.pollydocs.org/advanced/telemetry.html) is now a part of Polly v8, giving you insights and analytics right out of the box. All built-in resilience strategies can generate telemetry data.

## Install v8 today

Transitioning to [Polly v8](https://web.archive.org/web/20250217232425/https://www.nuget.org/packages/Polly.Core/) is a breeze. Embrace the change in terminology, adapt to the resilience pipelines, and enjoy the benefits of a more modern Polly library. Be sure to check out [pollydocs.org](https://web.archive.org/web/20250217232425/https://www.pollydocs.org/) for the latest documentation. As always, feel free to [post GitHub issues](https://web.archive.org/web/20250217232425/https://github.com/App-vNext/Polly/issues) if you have questions or feature suggestions. We'll do our best to address them as we continue to nurture this project.

Thank you for being a part of our community, and I wish you all the best!
