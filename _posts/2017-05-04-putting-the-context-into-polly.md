---
layout: post
title: "Using Execution Context in Polly"
author: Dylan Reisenberger
date: 2017-05-04
---

**TL;DR In Polly V5.1.0, we've extended `Context` so that it can be used to pass information between different parts of an execution through a policy. Featured Use Cases include honouring `RetryAfter` headers, and re-establishing authentication automatically.**

---

### Why `Context`?

Web request frameworks in .NET such as ASP.NET Core or NancyFX typically have a context object that travels with each request, allowing information to be exchanged between different parts of the code handling a request.

When we added [`PolicyWrap`](https://web.archive.org/web/20250318073833/https://github.com/App-vNext/Polly/wiki/PolicyWrap) to Polly, we felt that a similar, context-carrying class should be part of each Polly execution. An execution through a `PolicyWrap` will typically travel through several `Policy` instances, and we might want to pass information to an inner policy, or gather information during the execution to assist with telemetry.

### `Context` in Polly up to v4.3.0

Up to v4.3.0, Polly had a context which:

- was read-only
- could be passed to certain parts of the execution, such as the `onRetry` delegate of any of a retry policy.

For example, one could define a policy:

```
Policy retryPolicy = Policy  
    .Handle<HttpRequestException>()
    .RetryAsync(3,
        onRetryAsync: async (exception, retryCount, context) => 
        {
            // This policy might be re-used in several parts of the codebase, 
            // so we allow the logged message to be tailored.
            logger.Warn($"Retry {retryCount} of {context["Operation"]}, due to {exception.Message}.");
        });
```

This policy could then be used around the codebase, with context specific to that call site passed in as part of the call:

```
retryPolicy.ExecuteAsync(  
    action: context => GetCustomerDetailsAsync(someId),
    contextData: new Dictionary<string, object> {{"Operation", "GetCustomerDetails"}});
```

### Sharing mutable information throughout an execution using `Context`: Polly v5.1.0

The preceding approach served its purpose well, but had some shortcomings: not all methods in the API had an overload accepting a `Context` parameter; and `Context`, once passed in, was read-only. Several feature requests, however, called for sharing and modifying context during an execution.

From Polly v5.1.0 therefore:

- `Context` is mutable
- All areas of the Polly API offer overloads taking a `Context`

Let's look at some uses for this.

#### Use Case: Re-establishing authentication using Retry

Many Polly users spotted that a retry policy could be used to refresh authorisation against an API for which you must hold some auth token, but that token periodically expires. A standard pattern was something like:

```
HttpClient httpClient = ...  
var authEnsuringPolicy = Policy<HttpResponseMessage>  
  .HandleResult(r => r.StatusCode == StatusCode.Unauthorized)
  .RetryAsync(1, onRetryAsync: async (e, i) => await AuthHelper.RefreshAuthorization(httpClient));

var httpResponseMessage =  
    await authEnsuringPolicy.ExecuteAsync(() => httpClient.GetAsync(uri));
```

The above pattern works by sharing the `httpClient` variable across closures, but a significant drawback is that you have to declare and use the policy in the same scope. This precludes a dependency injection approach where you define policies centrally on startup, then provide them by DI to the point of use. Using DI with Polly in this way is a powerful pattern for separation of concerns, and allows easy stubbing out of Polly in unit testing.

From Polly v5.1.0, with `Context` available as a state variable to every delegate, the policy declaration can be rewritten:

```
var authEnsuringPolicy = Policy<HttpResponseMessage>  
  .HandleResult(r => r.StatusCode == StatusCode.Unauthorized)
  .RetryAsync(1, onRetryAsync: async (ex, i, context) => await AuthHelper.RefreshAuthorization(context["httpClient"]));
```

And the usage (elsewhere in the codebase):

```
var httpResponseMessage =  
    await authEnsuringPolicy.ExecuteAsync(context => context["httpClient"].GetAsync(uri), 
    contextData: new Dictionary<string, object> {{"httpClient", httpClient}}
    );
```

Passing context as state-data parameters in the different parts of policy execution allows policy declaration and usage now to be separate.

Finally on this Use Case, a nice aspect of Polly is that you can [combine the same policy type more than once into a `PolicyWrap`](https://web.archive.org/web/20250318073833/https://github.com/App-vNext/Polly/wiki/PolicyWrap#using-the-same-type-of-policy-more-than-once-in-a-wrap). Thus, using a retry policy as above to guarantee authorisation can still be combined in the same call with another retry policy for transient-fault handling.

#### Use Case: Honoring `RetryAfter` HTTP headers

**EDIT**: A Use Case covered in an earlier version of this blog post covered how to use mutable `Context` to allow Polly's `WaitAndRetry` policy to take account of `RetryAfter` or 429 HTTP headers which may be returned by an HTTP request.

The above scenario is now handled more directly with a [dedicated variant of the `sleepDurationProvider` delegate on wait-and-retry policies](https://web.archive.org/web/20250318073833/https://github.com/App-vNext/Polly/wiki/Retry#when-the-response-specifies-how-long-to-wait-before-retrying).

#### Is mutable `Context` thread-safe?

You might ask whether mutable `Context` is thread-safe: it is. There are two keys to this.

First, each execution has its own instance of `Context`, so concurrent executions don't pollute each other's context.

Second, *within* an execution, we can expect that different parts of the policy (for instance the `onRetry` delegate and the executed delegate) do not execute at the same time. For both sync and async executions, Polly ensures that policy hooks (eg `onRetry` or `onBreak` delegates) complete before the next phase of policy operation starts.

An exception to this would be if you intentionally off-load work onto a background thread in one of the policy hooks: in that case, the off-loaded code could run concurrent with other aspects of policy operation. In that scenario, copy the elements of context you want to use into local variables before off-loading.

### `Context` keys added in Polly v5.0.6

Finally, a brief look backward: `Context` was extended in v5.0.6 to aid tracking of policy executions in logging and metrics. [Four keys were added](https://web.archive.org/web/20250318073833/https://github.com/App-vNext/Polly/wiki/Keys-and-Context-Data) and are available as part of every execution:

```
Context.PolicyKey     // A key unique/scoped to the Policy instance executing  
Context.PolicyWrapKey // A key unique/scoped to the PolicyWrap instance executing  
Context.OperationKey  // A key scoped to the execution call site  
Context.CorrelationId// An automatically generated Guid, unique to every invocation
```

The use of `Context` shown in the first code example of this blog post could thus be rewritten and extended (to demonstrate the new keys) as below:

```
Policy retryPolicy = Policy  
    .Handle<HttpRequestException>()
    .RetryAsync(3,
        onRetryAsync: (exception, i, context) =>
        {
            logger.Log($"[{context.CorrelationId}] Retry {i} of {context.OperationKey} " + 
                "using {context.PolicyKey}, due to {exception.Message}.");
        })
   .WithPolicyKey("MyStandardHttpRetry");
```

Usage:

```
retryPolicy.ExecuteAsync(  
    action: context => GetCustomerDetails(someId),
    contextData: new Context("GetCustomerDetails")
    );
```

The extra keys allow us to capture richer metadata around the transient faults Polly is handling - what is happening where, which Policy handled it, and so on. They will also assist, identifying data by policy, call site or individual execution, in the future aggregation of metrics.

The [wiki documentation](https://web.archive.org/web/20250318073833/https://github.com/App-vNext/Polly/wiki/Keys-and-Context-Data) describes in detail how each key can be set.
