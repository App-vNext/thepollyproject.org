---
layout: post
title: "Introducing custom Polly policies and Polly.Contrib (Custom policies Part I)"
author: Dylan Reisenberger
date: 2019-02-13
---

# Introducing custom policies

The Polly team have long wanted to allow users to extend Polly's capability with custom policies.

[Polly v7.0](https://www.nuget.org/packages/Polly/7.0.0) introduces a simple mechanism for authoring custom policies which integrate fully with the existing Polly architecture: the fault-handling syntax, the execution overloads, and the ability to combine policies in a `PolicyWrap`.

This article introduces custom policies and the Polly.Contrib. If you're just interested in the how, skip straight to:

- [Part II: Authoring a non-reactive custom policy](/2019/02/13/authoring-a-proactive-polly-policy-custom-policies-part-ii.html) (a policy which acts on all executions)
- [Part III: Authoring a reactive custom policy](/2019/02/13/authoring-a-reactive-polly-policy-custom-policies-part-iii-2.html) (a policy which react to faults).
- [Part IV: Custom policies for all execution types](/2019/02/13/custom-policies-for-all-execution-types-custom-policies-part-iv.html): sync and async, generic and non-generic.

## Why custom policies?

There were three drivers for introducing custom policies to Polly:

#### 1. To allow users to write *any* custom Policy

Custom policies allow you to use `PolicyWrap` as a generalised execution-dispatch wrapper - your custom Policy can act as middleware for *any* execution.

There is no limit to what custom policies can do (we don't impose a structure) - a new policy could add extra information, capture extra information, intervene in how the passed code actually executes (as many Polly policies do), schedule execution in a new way ...

#### 2. To start a Polly.Contrib

Sometimes the community has more ideas for features than the core Polly maintainers have time to build! As well as accepting PRs into Polly, we want to give the community easier ways to explore and author add-ons to Polly - be that cache providers, syntax additions, or custom policies which can integrate with all the goodness of the existing Polly execution dispatch.

The Polly team is kick-starting the Polly.Contrib with:

- blank templates for authoring your own custom policy - these ready-made repos integrate to the latest Polly and have built-in build-script packaging to nuget
- an example custom policy to capture execution timings
- an example custom policy simply to log exceptions/faults and rethrow.

To get going, simply fork/duplicate one of the blank templates and code away!

If you'd like your custom policy to be part of [Polly.Contrib](https://github.com/Polly-Contrib), that'd be awesome (in fact we actively encourage it!). Bringing your custom policy (or other contribution) into the Polly-Contrib gives you:

- exposure and recognition under the Polly brand
- in-built CI (AppVeyor) which builds to nuget packages
- ability to publish the nugets under the Polly-Contrib organisation
- involvement in a wider team who can support and advise.

[Contact us on Polly slack](http://www.pollytalk.org/) to move your contrib into Polly-Contrib and we can help organise delivering your awesomeness to the Polly community!

#### 3. To deliver new functionality outside the main Polly package (..."Welcome Simmy!")

[Simmy](https://github.com/Polly-Contrib/Simmy) is a major new package from the Polly team and some awesome contributors [@vany0114](https://github.com/vany0114) and [@mebjas](https://github.com/mebjas). Simmy opens a path for **chaos-engineering** and **fault injection** using Polly. It's aimed at both live-testing the resilience of your production systems; and simulating faults in the unit testing or CI phase.

As a fault-*injection* tool, Simmy has a different focus to Polly, and we wanted to host the new concept in a package with its own name and identity.

## Where next?

To learn how to author your first custom policy, skip straight to:

- [Part II: Authoring a non-reactive custom policy](/2019/02/13/authoring-a-proactive-polly-policy-custom-policies-part-ii.html) (a policy which acts on all executions)
- [Part III: Authoring a reactive custom policy](/2019/02/13/authoring-a-reactive-polly-policy-custom-policies-part-iii-2.html) (a policy which react to faults).
- [Part IV: Custom policies for all execution types](/2019/02/13/custom-policies-for-all-execution-types-custom-policies-part-iv.html): sync and async, generic and non-generic.
