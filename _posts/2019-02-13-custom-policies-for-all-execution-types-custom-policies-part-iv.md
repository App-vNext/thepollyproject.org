---
layout: post
title: "Custom policies for all execution types (Custom policies Part IV)"
author: Dylan Reisenberger
date: 2019-02-13
---

In the previous articles in this series, we have seen how to author custom reactive and proactive Polly policies:

- [Part I: Introducing custom Polly policies and the Polly.Contrib](/2019/02/13/introducing-custom-polly-policies-and-polly-contrib-custom-policies-part-i.html)
- [Part II: Authoring a proactive custom policy](/2019/02/13/authoring-a-proactive-polly-policy-custom-policies-part-ii.html) (a policy which acts on all executions)
- [Part III: Authoring a reactive custom policy](/2019/02/13/authoring-a-reactive-polly-policy-custom-policies-part-iii-2.html) (a policy which react to faults).

This article in the series - Part IV - explains (with links to examples) the easiest way to author all forms of a Polly policy, for both sync and async, and both generic and non-generic cases.

### The four forms of each Polly policy

For simplicity, Parts II and III of this series assumed we were developing a custom policy for use with [Polly and HttpClientFactory](https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory). This means that all executions were async and returned `Task<HttpResponseMessage>`. This meant we only needed to demonstrate the `AsyncPolicy<TResult>` form of each policy.

Those familiar with Polly will know that policies offered by Polly in fact exist in four forms:

- synchronous non-generic : `Policy`
- synchronous generic : `Policy<TResult>`
- asynchronous non-generic : `AsyncPolicy`
- asynchronous generic : `AsyncPolicy<TResult>`

A Polly policy intended to be generally useful (for example, to be offered as a nuget package) should generally support all four of these forms. However, in fact only implementing two forms is necessary:

- synchronous generic (ie the expected implementation for `Policy<TResult>`)
- asynchronous generic (the expected implementation for `AsyncPolicy<TResult>`)

This blog post explains a pattern for achieving that simplification.

### Separate sync and async implementations

It should be relatively obvious that separate sync and async implementations are needed. Async is viral. Async implementations need to be able to execute the `Func<Context, CancellationToken, Task<TResult>>` passed by the user to `policy.ExecuteAsync(...)`. To do this they have to use `await` internally.

Synchronous implementations, on the other hand, cannot use `await` internally.

### Common implementations for non-generic and generic policy forms

Consider for a moment the synchronous non-generic `Policy` (eg `RetryPolicy`). Users can either (among various related overloads):

- `.Execute(Action)`; or
- `.Execute<TResult>(Func<TResult>)`.

Polly avoids you having to write a separate implementation for the `Action` case by simply executing an `Action action` through the `Func<TResult>` implementation, as the equivalent of:

```
Func<object> wrapper = () => { action(); return ThrowAwaySingleton; }
```

(In current implementations, in fact an empty struct rather than object is used.)

Similar simplifications exist for the async case.

The net effect of this is that the only implementations needed are:

- a single `TResult`-returning implementation for both non-generic and generic synchronous policy forms
- a single `Task<TResult>`-returning implementation for both non-generic and generic asynchronous policy forms

### Seeing the simplification in practice

A suggested implementation to achieve the simplification is shown in our custom policy templates (and also ready for you to lift off the shelf as a template):

- a [common implementation as a static method in a third class](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates/blob/04de137ddb518fd8adadb43408bad5f58df93640/ProactivePolicyTemplate/src/Polly.Contrib.ProactiveCustomPolicyTemplate/ProactiveFooEngine.cs) (often called `FooEngine`)
- the non-generic form of the policy just [delegating to this implementation](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates/blob/04de137ddb518fd8adadb43408bad5f58df93640/ProactivePolicyTemplate/src/Polly.Contrib.ProactiveCustomPolicyTemplate/ProactiveFooPolicy.cs#L36-L49)
- the generic form of the policy [delegating to the same implementation](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates/blob/04de137ddb518fd8adadb43408bad5f58df93640/ProactivePolicyTemplate/src/Polly.Contrib.ProactiveCustomPolicyTemplate/ProactiveFooPolicyTResult.cs#L35-L48)

The async files in [the same folder as above](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates/tree/04de137ddb518fd8adadb43408bad5f58df93640/ProactivePolicyTemplate/src/Polly.Contrib.ProactiveCustomPolicyTemplate) also demonstrate the same pattern for async policies.

Any policy implementation in the main Polly repo also demonstrates the pattern.

## Where next?

This concludes our series on authoring custom policies in Polly.

### Grab the template

If you want to dive straight in to experimenting with a custom policy, just grab the [template repo](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates) and start copy/paste/rename/extend-ing the classes.

For any questions, reach out to the Polly team at [Polly github](https://github.com/App-vNext/Polly/) or [Polly slack](http://www.pollytalk.org/).

If you'd like your custom policy to be part of [Polly.Contrib](https://github.com/Polly-Contrib), [contact us on Polly slack](http://www.pollytalk.org/), we'll have some brief discussion to understand how the policy fits, then we can set up a Polly.Contrib repo - to which you have full rights - to help you manage and deliver your awesomeness to the Polly community!

Happy customising!
