---
layout: post
title: "Authoring a proactive Polly policy (Custom policies Part II)"
author: Dylan Reisenberger
date: 2019-02-13
---

In this article we'll build our first custom Polly policy: a proactive Policy to capture execution timings.

Polly polices fall into two categories: **reactive** (which react to faults) and **non-reactive** or **proactive** (which act on all executions). To author a policy which reacts to faults, see [Part III: Authoring a reactive custom policy](/2019/02/13/authoring-a-reactive-polly-policy-custom-policies-part-iii-2.html).

For background on custom policies and the Polly.Contrib, see [Part I: Introducing custom Polly policies](/2019/02/13/introducing-custom-polly-policies-and-polly-contrib-custom-policies-part-i.html).

A final article in the series, Part IV, covers [Custom policies for all execution types: sync and async, generic and non-generic](/2019/02/13/custom-policies-for-all-execution-types-custom-policies-part-iv.html).

## Authoring a non-reactive custom policy: Capture execution timing

For simplicity, in this article we'll assume we're developing a custom policy for use with [Polly and HttpClientFactory](https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory). This means that all executions are async and return `Task<HttpResponseMessage>`.

For this, we only need to implement the `IAsyncPolicy<TResult>` form of the policy. For other forms, see [Part IV of the series](/2019/02/13/custom-policies-for-all-execution-types-custom-policies-part-iv.html).

### Step 1: Name your policy and extend the base class

The base class for async generic policies is, as you might expect, `AsyncPolicy<TResult>`. So start by declaring:

```c#
public class AsyncTimingPolicy<TResult> : AsyncPolicy<TResult>
{
}
```

By extending the base class, your policy is already plugged in to all the benefits of the existing Polly architecture: the execution-dispatch, the integration into `PolicyWrap`.

The compiler or IDE will report:

```
AsyncTimingPolicy<TResult> does not implement inherited abstract member AsyncPolicy<TResult>
.ImplementationAsync(Func<Context, CancellationToken, Task<TResult>>, Context, CancellationToken, bool)
```

### Step 2: Add a 'no-op' implementation

Let's fulfil the abstract method with a stub (your IDE may have a tooltip or shortcut to help):

```c#
protected override async Task<TResult> ImplementationAsync(
    Func<Context, CancellationToken, Task<TResult>> action, 
    Context context, 
    CancellationToken cancellationToken,
    bool continueOnCapturedContext)
{
    throw new NotImplementedException();
}
```

This method is where your policy defines its implementation!

Let's look at the parameters - these are the information passed when the user executes a call through the policy:

- `Func<Context, CancellationToken, Task<TResult>> action` represents the delegate executed through the policy
- `Context context` is the context passed to execution
- `CancellationToken cancellationToken` is (you guessed it) the cancellation token passed to execution
- and `bool continueOnCapturedContext`, whether the user asked to continue after `await`s on a captured context.

The parameters map directly to the calling code:

```c#
var result = policy.ExecuteAsync(action, context, cancellationToken, continueOnCapturedContext);
```

So, let's flesh out our policy to provide a basic 'no-op' implementation. This just executes the code passed to the policy 'as is', using the parameters the user passed to execute the `action`. The parameter `continueOnCapturedContext` controls continuation context after the `await`:

```c#
protected override async Task<TResult> ImplementationAsync(
    Func<Context, CancellationToken, Task<TResult>> action, 
    Context context, 
    CancellationToken cancellationToken,
    bool continueOnCapturedContext)
{
    return await action(context, cancellationToken).ConfigureAwait(continueOnCapturedContext);
}
```

That's it for a no-op implementation!

*Aside*: To make it easier for you to get started, Polly [provides all this as a template starting point for a custom policy](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates). To author your own custom policy, you can grab the template repo and copy/paste/rename the classes.

### Step 3: Add your custom functionality

To implement custom functionality, you just code ... whatever you want ... around the `await action(...)` statement.

We're going to calculate execution duration, so we'll use `System.Diagnostics.Stopwatch`:

```c#
protected override async Task<TResult> ImplementationAsync(
    Func<Context, CancellationToken, Task<TResult>> action, 
    Context context, 
    CancellationToken cancellationToken,
    bool continueOnCapturedContext)
{
    long before = Stopwatch.GetTimestamp();
    try {
        return await action(context, cancellationToken).ConfigureAwait(continueOnCapturedContext);
    }
    finally
    {
        long elapsed = Stopwatch.GetTimestamp() - before;
    }
}
```

Hmm, we still need to let the user do something with that `elapsed` value. To keep this blog post simple and illustrate some points about async policy implementation, we'll intentionally allow users to provide an async delegate as `timingPublisher`. (*For a production implementation, you might want instead to adopt the event pattern or `IObservable<>`*.)

```c#
Func<TimeSpan, Context, Task> timingPublisher
```

We also make the `timingPublisher` delegate take an input parameter `Polly.Context`: this execution-scoped context travels with every Polly execution. Users can (optionally) use it to pass extra information in to the execution, to exchange information between different parts of the execution, or to capture information after execution ([more info here](/2017/05/04/putting-the-context-into-polly.html) and [here](https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory#use-case-exchanging-information-between-policy-execution-and-calling-code)). It also carries important [metadata about the execution](https://github.com/App-vNext/Polly/wiki/Keys-And-Context-Data) which can be useful for filtering. It's good practice to make `Context` an input parameter to any delegate you let users configure on a policy.

```c#
public class AsyncTimingPolicy<TResult> : AsyncPolicy<TResult>
{
    private static readonly double TimestampToTicks = TimeSpan.TicksPerSecond / (double)Stopwatch.Frequency;
    private readonly Func<TimeSpan, Context, Task> timingPublisher;

    public AsyncTimingPolicy(System.Func<TimeSpan, Context, Task> timingPublisher)
    {
        this.timingPublisher = timingPublisher ?? throw new ArgumentNullException(nameof(timingPublisher));
    }

    protected override async Task<TResult> ImplementationAsync(
        Func<Context, CancellationToken, Task<TResult>> action, 
        Context context, 
        CancellationToken cancellationToken,
        bool continueOnCapturedContext)
    {
        long before = Stopwatch.GetTimestamp();
        try {
            return await action(context, cancellationToken).ConfigureAwait(continueOnCapturedContext);
        }
        finally
        {
            long elapsed = Stopwatch.GetTimestamp() - before;
            TimeSpan elapsedAsTimeSpan = new TimeSpan((long)(TimestampToTicks * elapsed));
            await timingPublisher(elapsedAsTimeSpan, context)
                .ConfigureAwait(continueOnCapturedContext); // [*]
        }
    }
}
```

Note [\*] the use of `.ConfigureAwait(continueOnCapturedContext)` on the extra `await` we added. Whenever you code a new async policy, you should decorate all `await` statements in this way, if you want your policy to play nicely with what Polly users expect. Best practice for libraries is to `.ConfigureAwait(false)`. However, some specialist uses of Polly (such as Actors) require continuations to continue on the original context; so Polly provides this control bool to be used on all `await` statements.

### Step 4: Add configuration syntax

Finally, add some configuration syntax so that users can create instances of your policy!

You'll see the code above had a public constructor. There's nothing wrong with this, but by convention, Polly configuration syntax uses static factory methods (eg `Policy.Timeout(30)`). So we would suggest amending the construction like this:

```c#
public class AsyncTimingPolicy<TResult> : AsyncPolicy<TResult>
{
    public static AsyncTimingPolicy<TResult> Create(Func<TimeSpan, Context, Task> timingPublisher) 
        => new AsyncTimingPolicy<TResult>(timingPublisher);

    private AsyncTimingPolicy(Func<TimeSpan, Context, Task> timingPublisher)
    {
        this.timingPublisher = timingPublisher ?? throw new ArgumentNullException(nameof(timingPublisher));
    }

    /* rest of policy unchanged */
}
```

## Let's take it for a spin!

Let's take the new `AsyncTimingPolicy<TResult>` for a spin!

This is also an example of a quick way to test HttpClientFactory with Polly policies in a Console App.

```c#
using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Contrib.TimingPolicy;

namespace ConsoleAppExampleForBlogPost
{
    class Program
    {
        static async Task Main(string[] args)
        {
            const string TestClient = "TestClient";

            IServiceCollection services = new ServiceCollection();

            services.AddHttpClient(TestClient)
                .AddPolicyHandler(AsyncTimingPolicy<HttpResponseMessage>.Create(PublishTiming));

            HttpClient configuredClient =
                services
                    .BuildServiceProvider()
                    .GetRequiredService<IHttpClientFactory>()
                    .CreateClient(TestClient);

            string[] urls = 
            {
                "https://www.google.com/",
                "https://www.google.co.uk/",
                "https://www.bbc.co.uk/"
            };

            foreach (var url in urls)
            {
                var context = new Context {["url"] = url};
                HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url);
                request.SetPolicyExecutionContext(context);

                var result = await configuredClient.SendAsync(request, default(CancellationToken));
            }

            Console.ReadKey();

        }

        static Task PublishTiming(TimeSpan executionDuration, Context context)
        {
            object url = "[unknown]";
            if (context?.TryGetValue("url", out url) ?? false)
            {
                Console.WriteLine($"Took {executionDuration.TotalSeconds:0.###} seconds retrieving {url}");
            }
            return Task.CompletedTask;
        }
    }
}
```

Here's some example output:

```
Took 0.331 seconds retrieving https://www.google.com/
Took 0.146 seconds retrieving https://www.google.co.uk/
Took 0.121 seconds retrieving https://www.bbc.co.uk/
```

Of course, writing to the Console is the least imaginative use. The intention of this policy is to enable you to capture execution timing metrics to your favourite time-series db (Prometheus, InfluxDB, Azure Time Series, App-Metrics).

### Where can I get the code?

The full source code for `AsyncTimingPolicy<TResult>` and the test console app is available in [this Github repo](https://github.com/Polly-Contrib/Polly.Contrib.TimingPolicy).

## Where next?

### Grab the template

If you want to dive straight in to experimenting with a custom policy, just grab the [template repo](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates) and start copy/paste/rename/extend-ing the classes.

### Authoring a reactive custom policy

In the next part of this series, [Part III](/2019/02/13/authoring-a-reactive-polly-policy-custom-policies-part-iii-2.html), we'll look at authoring a *reactive* custom policy, to log any exception or fault and then rethrow or bubble it outwards. The new policy will allow you to inject custom logging into any position in a `PolicyWrap`.

Finally, in [Part IV](/2019/02/13/custom-policies-for-all-execution-types-custom-policies-part-iv.html), we'll look at how to author other forms of policy - synchronous policies and non-generic policies - in the most efficient manner.
