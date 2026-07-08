---
layout: post
title: "Polly 5.0 - a wider resilience framework!"
author: Dylan Reisenberger
date: 2016-10-25
---

![Polly v5.0](/assets/images/2016/10/polly-five-o.png)

Today we [released Polly v5.0 in alpha to Nuget](https://www.nuget.org/packages/polly). This is the next step in making Polly a much wider resilience framework for .NET, as Hystrix is for Java.

TL;DR, the new resilience policies and features are:

- [Bulkhead isolation](https://github.com/App-vNext/Polly/wiki/Bulkhead) - 'Don't let one fault sink the whole ship!'
- [Timeout policy](https://github.com/App-vNext/Polly/wiki/Timeout) - what it says on the tin... but with support for timing-out *any* delegate
- [Fallback policy](https://github.com/App-vNext/Polly/wiki/Fallback) - 'If all else fails, degrade gracefully'
- [PolicyWrap](https://github.com/App-vNext/Polly/wiki/PolicyWrap) - Combine strategies, for 'defence in depth'
- [New context keys](https://github.com/App-vNext/Polly/wiki/Keys-And-Context-Data) to enrich logging and support metrics
- Cancellation support for sync actions

For those unfamiliar, Polly is a fluent, thread-safe .NET resilience and transient-fault handling library, with full sync and async support. The new policies join the existing:

- [family](https://github.com/App-vNext/Polly#retry) of [Retry](https://github.com/App-vNext/Polly/wiki/Retry) strategies
- [Circuit-Breaker](https://github.com/App-vNext/Polly/wiki/Circuit-Breaker)
- [Advanced Circuit-Breaker](https://github.com/App-vNext/Polly/wiki/Advanced-Circuit-Breaker)

## The new resilience policies

Polly policies to date - the retry and circuit-breaker families - have been mostly **reactive** - in the sense that they *react* to faults raised during execution.

Polly v5.0 strengthens the resilience armoury by introducing **proactive** strategies, which influence how delegates are run *before* and *during* running. **Bulkhead isolation** proactively manages load to avoid catastrophic failure. **Timeout** lets you walk away from executions that seem destined to fail. **Cache** (forthcoming in v5.1) lets you avoid wasting resource on repeated similar calls.

Let's dive in.

### Bulkhead isolation

[Bulkhead isolation](https://github.com/App-vNext/Polly/wiki/Bulkhead) proactively isolates the execution of your delegates to limited resource (thread) pools, so that one stream of actions going rogue can't sink the whole ship.

Imagine one stream of actions starts faulting slowly. All threads in a caller could (if ungoverned) end up waiting on that system, until the blocking calls eventually consume so much resource (memory, threads, CPU etc) that this starves the system from doing anything else. Suddenly, that one failure has become a *cascading* failure.

Bulkhead isolation prevents this, by limiting the resources (threads) usable by separate call streams - preventing one problem bringing the whole ship down.

#### What was that, guv'nor?

In addition to this, a Bulkhead policy can also be used as a kind of 'throttle' or 'governor', which keeps an individual application instance running at the optimum load.

This is particularly useful when combined with automated horizontal scaling: you can use the overload signals from bulkheads as the trigger for when greater horizontal scaling is necessary.

The [deep doco on the wiki](https://github.com/App-vNext/Polly/wiki/Bulkhead#configuration-recommendations) discusses this (and other configuration options) more deeply.

### Timeout policy

[Timeout policy](https://github.com/App-vNext/Polly/wiki/Timeout), erm, does what it says on the tin ... but with a twist.

#### Optimistic timeout

Optimistic timeout uses a timing-out `CancellationToken` to cancel the governed operation, expecting the executed delegate to honor this.

The `CancellationToken` approach also allows the timeout to apply to *any* policies wrapped deeper inside a `PolicyWrap`: all Polly policies support cancellation.

#### Pessimistic timeout

Pessimistic timeout exists for those painful times when some component you have to use offers no in-built timeout, nor any means of cancellation.

Pessimistic timeout lets your calling thread *still* walk away from these ungovernable calls - if they haven't returned within the timeout - at the cost (in sync variants only) of an extra thread. Polly also lets you [capture the timed-out task later with a task continuation](https://github.com/App-vNext/Polly/wiki/Timeout#pessimistic-timeout-1), to mop up any badness that may have occurred.

We *strongly* recommend you use optimistic timeouts wherever possible (certainly in any code over which you have control). Pessimistic mode exists for those ungovernable legacy third-party APIs, without which our lives wouldn't be the same.

### Fallback policy

A [Fallback policy]((https://github.com/App-vNext/Polly/wiki/Fallback)) simply lets you specify an alternative value:

```
Policy  
   .Handle<Whatever>()
   .Fallback<Avatar>(Avatar.Blank)
```

or function to provide an alternative:

```
Policy  
   .Handle<Whatever>()
   .Fallback<Avatar>(() => Avatar.GetRandomAvatar())
```

... when all else fails. Similar syntax provides alternative actions to be run on fallback, for [void-returning calls](https://github.com/App-vNext/Polly/wiki/Fallback#void-returning-calls).

I like the extra encouragement this policy gives you (or your dev team), to think through - at the time of first coding - what the fallback strategy will be, for *every* execution.

### PolicyWrap

PolicyWrap provides a flexible way to encapsulate applying multiple policies to delegates:

```
Policy.Wrap(fallback, breaker, retry).Execute(action);
```

In this example, a circuit-breaker wraps a retry policy applied to the delegate. A fallback policy in turn wraps these, to provide a fallback value when execution fails.

#### Reusability

Like any other policy, PolicyWrap is **thread-safe** and **can be re-used across multiple call sites**, allowing you to define centralised resilience strategies which may be used in multiple places.

#### Theme and variations

A `PolicyWrap` is really just another kind of `Policy`, which means it can also be onward-combined into further wraps.

This allows you to adopt a theme-and-variations approach to resilience, establishing common resilience strategies (perhaps shared across a group of actions), with variations for specific call sites:

```
PolicyWrap commonResilience = Policy.Wrap(retry, breaker, timeout);  
...
// ... then wrap in extra policies specific to a call site:
Avatar avatar = Policy  
   .Handle<Whatever>()
   .Fallback<Avatar>(Avatar.Blank)
   .Wrap(commonResilience)
   .Execute(() => { /* get avatar */ });

// Share the commonResilience, but wrap with a different fallback:
Reputation reps = Policy  
   .Handle<Whatever>()
   .Fallback<Reputation>(Reputation.NotAvailable)
   .Wrap(commonResilience)
   .Execute(() => { /* get reputation */ });
```

There are in fact no restrictions on how you combine policies, but the [deeper wiki documentation provides guidance](https://github.com/App-vNext/Polly/wiki/PolicyWrap#ordering-the-available-policy-types-in-a-wrap).

### Treating distinct exceptions differently

Another trick is that you may use the *same kind of policy twice* (or more) in a wrap, to express variant handling for different faults:

```
var severeBreaker = Policy.Handle<CatastrophicException>()  
    .CircuitBreaker(1, TimeSpan.FromMinutes(3));
var gentleBreaker = Policy.Handle<NigglingException>()  
    .CircuitBreaker(5, TimeSpan.FromSeconds(10));

Policy.Wrap(..., severeBreaker, gentleBreaker, ...).Execute(...);
```

## What else is new?

### Synchronous cancellation

Although `CancellationToken` is typically seen with async actions, there's no reason why sync actions can't take a `CancellationToken` too. From v5.0, Polly supports this.

My favourite usage so far is for graceful shutdown of a Windows Service-hosted microservice, which needed to consume a 3rd party sync API. In the shutdown event, cancel a service-wide `CancellationToken`, and with Polly v5.0, that now extends to co-operative cancellation of the sync actions too, including waits-between-tries of `WaitAndRetry`.

### Keys and execution context

All policies can now be assigned a `PolicyKey`:

```
var retry = Policy.Handle<Whatever>.Retry(3)  
   .WithPolicyKey("ThisPolicyKey");
```

And executions an `ExecutionKey`:

```
retry.Execute(() => DoSomething(), new Context("MyExecutionKey"));
```

You can capture these keys on the `Context` passed to any state-change delegate:

```
var retry = Policy  
    .Handle<Whatever>()
    .Retry(3, onRetry: (exception, retryCount, context) =>
       {
           logger.Error($"Retry {retryCount} of {context.PolicyKey} at {context.ExecutionKey} failed, due to: {exception}.");
       })
    .WithPolicyKey("ThisPolicyKey");
```

As we [add metrics and dashboarding to Polly](https://github.com/App-vNext/Polly/wiki/Polly-Roadmap), these keys will form the bedrock for identifying what's happening where in your app, in real-time.

For more, see [Keys and Context Data](https://github.com/App-vNext/Polly/wiki/Keys-And-Context-Data) on the wiki.

## Breaking changes?

We've avoided breaking changes for fifteen nuget releases, but for v5.0:

- We're **discontinuing .NET3.5 support**, as it can't support the new policies.
- We **removed ContextualPolicy**, an undocumented (but public) class which, in early releases, distinguished policies able to accept executions taking a custom context. All executions now carry context. If any of your code referenced `ContextualPolicy`, simply reference `Policy` instead.
- We tidied away couple of non-sensical `ExecuteAsync()` overloads.
- All .NET4.0 support is now found in the `Polly.Net40Async` nuget package.

The full v5.0 release notes are [here](https://github.com/App-vNext/Polly/blob/v5.0-alpha/CHANGELOG.md).

## What ~~could~~ did change before the final v5.0 release?

Not too much. We ~~want to~~:

- DID Refine **.NET Standard targeting**
- DID Revise **.NET4.0 options for async Semaphore**
- **Considered removing** (BUT DID NOT remove) `DelegateResult<TResult>`. When a policy handles results as failures using `.Handle<TResult>()`, the `DelegateResult<TResult>` class is used to wrap either the exception or handled-result which caused the failure. Simpler might be just to pass `(Exception, TResult)` to those delegates.

## Feedback

To feed back on v5.0, join us on [github](https://github.com/App-vNext/Polly/), [slack](http://www.pollytalk.org/), or comment on this post.

## Where next?

**CachePolicy** is already in development, intending to target in-memory cache, disk cache, HttpCache, and a range of cloud cache providers from Redis thru Azure blob and aws s3. Tell us [in the github issue](https://github.com/App-vNext/Polly/issues/136) or [on slack](http://www.pollytalk.org/) if there are other cache providers you'd like supported!

The [longer-term roadmap](https://github.com/App-vNext/Polly/wiki/Polly-Roadmap) envisages:

- **emitting metrics for telemetry**
- **configuration from config**
- **dynamic reconfiguration during running**, for in-production tweaking of timeouts, circuit-breakers etc.

Comment on the roadmap [here](https://github.com/App-vNext/Polly/issues/90).

## Finding out more

This blog post can inevitably only give a taste of what the new resilience policies offer. For full details, see the deep doco for each policy on the [wiki](https://github.com/App-vNext/Polly/wiki), and the [readme](https://github.com/App-vNext/Polly/tree/v5.0-alpha#resilience-policies).
