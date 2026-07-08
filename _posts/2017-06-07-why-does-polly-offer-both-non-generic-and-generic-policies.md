---
layout: post
title: "Why does Polly offer both non-generic and generic policies?"
author: Dylan Reisenberger
date: 2017-06-07
---

## Background

Polly offers both non-generic policies `Policy` with a generic `.Execute<TResult>(...)` *method*, as well as generic policies `Policy<TResult>`. This article sets out to answer questions Polly users sometimes raise: Why do both exist? And why can't I just use the generic `.Execute<TResult>(...)` *method* everywhere?

**TL;DR** Offering generic `Policy<TResult>` policies allows compile-time type-binding and intellisense for two key scenarios:

- when configuring policies to handle `TResult` types
- when using `PolicyWrap` to combine policies for executions returning `TResult`.

### Non-generic policies: `Policy`

The non-generic policy `Policy` can be used to execute delegates returning `void`.

```
Policy policy = // ... (non-generic)

policy.Execute(/* some Action */)
```

It also offers a generic *method* overload to execute delegates returning any `TResult`:

```
Policy policy = // ... (non-generic still)

TResult result = policy.Execute<TResult>(/* some Func<..., TResult> */)
```

Given the non-generic policies offer this generic execute *method*, why also the generic policies `Policy<TResult>`?

### Generic policies: `Policy<TResult>`

The drawback with the generic *method* overload above, on the non-generic policy, is that its scope is limited to that method: it can't offer compile-time type-binding to anything beyond that execute overload. And that means no type-binding to any other aspect of `Policy` or `PolicyWrap` configuration.

And multiple typed operations with no type-binding between them spells trouble.

To explore this in more detail, let's look at some examples.

#### Binding `.HandleResult<TResult>(...)` and `.Execute<TResult>(...)`

Generic policies `Policy<TResult>` allow compile-time type binding between `.HandleResult<TResult>(...)` and the `.Execute<TResult>(...)` calls made on the policy. For example:

```
Policy<HttpResponseMessage> policy = Policy  
    .HandleResult<HttpResponseMessage>(r => r.StatusCode == HttpStatusCode.BadGateway)
    .WaitAndRetryAsync(4, TimeSpan.FromSeconds(5));

HttpResponseMessage result = policy.ExecuteAsync(/* some Func<HttpResponseMessage> */);
```

Without this type-binding, it would be possible to write (and compile) non-sensical code such as:

```
Policy  
    .Handle<foo>(Func<foo, bool>)
    .Retry(2)
    .Execute<bar>(Func<bar>);
```

This was deemed unacceptable. If executing `Func<bar>` on a `foo`-handling Policy *was* compilable, how should it execute?

- If the `foo/bar` mismatch were to throw an exception, then why not enforce the type matching at compile time, rather than leave it to a run-time failure?
- If the `foo/bar` mismatch were to *not* throw an exception, it would have to be silently ignored. (There's no other meaningful option.) But this carries the grave risk of leading users into a pit of failure. Unwittingly mismatching the `.Handle<>()` type and the `.Execute<>()` type would lead to *silent* failure of the Policy. This could be particularly pernicious when refactoring - a slight wrong change and, poof, your Polly protection is (silently) gone.

#### Binding multiple `Policy<TResult>` instances into a `PolicyWrap<TResult>`

Generic policies `Policy<TResult>` also allow compile-time type-binding between different `Policy<TResult>` instances combined into a `PolicyWrap<TResult>`.

In a policy protecting an Http call, for example, you might create a `PolicyWrap<HttpResponseMessage>` combining:

- a `RetryPolicy<HttpResponseMessage>` handling particular `HttpResponseMessage.StatusCode` values
- a `CircuitBreakerPolicy<HttpResponseMessage>` handling `HttpResponseMessage.StatusCode` values
- a `FallbackPolicy<HttpResponseMessage>`.

The generic policies give you the intellisense and compile-time checking to combine these only correctly, just as when coding other generic functional monads such as Linq or Rx expressions.

The alternative - *permitting* `policy1<Foo>.Wrap(policy2<Bar>)` - implies the same problems around non-type-safe combinations discussed above.

### Mixing non-generic and generic polices into a `PolicyWrap<TResult>`

A riff on the above is that you can however combine non-generic and generic policies in a `PolicyWrap`.

Returning to the preceding `PolicyWrap<HttpResponseMessage>`, you could additionally combine in a `TimeoutPolicy`. `TimeoutPolicy` doesn't respond to results; it pre-empts them, when necessary. So it's always non-generic. Polly therefore permits the following:

```
TimeoutPolicy timeout = // ...  
RetryPolicy<HttpResponseMessage> retry = // ...  
CircuitBreakerPolicy<HttpResponseMessage> breaker = // ...  
FallbackPolicy<HttpResponseMessage> fallback = // ...

// Polly permits this, mixing non-generic and generic policies.
PolicyWrap<HttpResponseMessage> combinedResilience =  
    fallback
    .Wrap(breaker) 
    .Wrap(retry)
    .Wrap(timeout);
```

For further information on combining policies, see the [PolicyWrap wiki](https://github.com/App-vNext/Polly/wiki/PolicyWrap).

### Summary

Polly's generic `Policy<TResult>` policies allows compile-time type-binding when configuring policies to handle `TResult` types, and when using `PolicyWrap` to combine policies handling `TResult` executions. This avoids the pitfalls of type-unsafe operations at runtime.

If however your policy needs don't extend to `.HandleResult()` clauses or policies that are intrinsically typed - `FallbackPolicy` and `CachePolicy` - then non-generic policies with the flexible generic *method* `Policy.Execute<TResult>(...)` remain your friend.
