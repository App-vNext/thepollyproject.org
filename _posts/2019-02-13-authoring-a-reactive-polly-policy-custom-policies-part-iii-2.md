---
layout: post
title: "Authoring a reactive Polly policy (Custom policies Part III)"
author: Dylan Reisenberger
date: 2019-02-13
---

In this article we'll build our first reactive custom Polly policy: a policy to log exceptions or fault-results.

Polly polices fall into two categories: **reactive** (which react to configured faults) and **non-reactive** / **proactive** (which act on all executions). To author a proactive policy, see [Part II: Authoring a proactive custom policy](/2019/02/13/authoring-a-proactive-polly-policy-custom-policies-part-ii.html).

For background on custom policies and the Polly.Contrib, see [Part I: Introducing custom Polly policies](/2019/02/13/introducing-custom-polly-policies-and-polly-contrib-custom-policies-part-i.html).

If you've already read Part II of this article series, the initial steps to create the reactive policy here are similar to those for the proactive policy covered in Part II. For what's different, skip straight to Steps 3 onwards, where we make the implementation react to the faults the policy handles, and tie the policy to Polly's existing `Policy.Handle<>(...)` configuration syntax.

## The goal: a policy to log faults

Polly already has configurable delegates hooks such as `onRetry`, `onBreak` and `onFallback`, which many users use for logging with the relevant policies. So why a new policy to log faults? And what exactly will the policy do?

The aim is that the policy will log any exception or fault and then just rethrow or bubble it outwards.

This makes it a flexible logging construct that can be injected into any position in a [`PolicyWrap`](https://github.com/App-vNext/Polly/wiki/PolicyWrap) (users have been [asking for this](https://stackoverflow.com/questions/42952057/polly-policy-to-log-exception-and-rethrow)).

It also makes for a good blog post example :~)

## Authoring a reactive custom policy: Log exceptions and fault-results

For simplicity, we'll assume we're developing a custom policy for use with [Polly and HttpClientFactory](https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory). This means that all executions are async and return `Task<HttpResponseMessage>`.

For this, we only need to implement the `IAsyncPolicy<TResult>` form of the policy. For other forms, see Part IV of the series.

### Step 1: Name your policy and extend the base class

The base class for async generic policies is, as you might expect, `AsyncPolicy<TResult>`. So start by declaring:

```c#
public class AsyncLoggingPolicy<TResult> : AsyncPolicy<TResult>
{
}
```

By extending the base class, your policy is already plugged in to all the benefits of the existing Polly architecture: the execution-dispatch, the integration into `PolicyWrap`.

The compiler or IDE will report:

```
AsyncLoggingPolicy<TResult> does not implement inherited abstract member AsyncPolicy<TResult>
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

### Step 3: Matching the faults the user configured

#### aka: Do what the user told you!

The first thing any reactive policy needs to do is honor the exceptions and results which the user configured the policy to handle. Remember, the user specifies this with syntax such as:

```c#
Policy<HttpResponseMessage>
    .Handle<HttpRequestException>()
    .OrResult((int)response.StatusCode >= 500 
       || response.StatusCode == HttpStatusCode.RequestTimeout);
```

Polly wraps that configuration up for you in two properties which are available on the configured policy instance:

- `ExceptionPredicates` - any exceptions the user configured the policy to handle
- `ResultPredicates` - any results the user configured the policy to handle

These are predicates, so essentially the implementation wants to do something like `ExceptionPredicates.Any(predicate => predicate(exception))`. The below skeleton for our reactive policy implementation shows the actual syntax:

```c#
protected override async Task<TResult> ImplementationAsync(
    Func<Context, CancellationToken, Task<TResult>> action, 
    Context context, 
    CancellationToken cancellationToken,
    bool continueOnCapturedContext)
{
    try
    {
        TResult result = await action(context, cancellationToken).ConfigureAwait(continueOnCapturedContext);

        if (!ResultPredicates.AnyMatch(result)) // [1]
        {
            return result; // Not an outcome the policy handles - just return it.
        }

        /* Here you add your custom logic for the results you handle */ // [3]
    
        /* The policy then has to return or exit somehow - return the result, substitute another result, or throw an exception */ // [5]
    }
    catch (Exception exception)
    {
        Exception handledException = ExceptionPredicates.FirstMatchOrDefault(exception); // [2]
        if (handledException == null)
        {
            throw; // Not an exception the policy handles - propagate the exception.
        }
        
        /* Here you add your custom logic for the exceptions you handle */ // [4]
    
        /* The policy then has to return or exit somehow - substitute a result, rethrow the exception, or throw another exception */ // [6]
    }
}
```

Let's dive in:

At [1] we check whether a returned result matches any of our `ResultPredicates`.

If an exception is thrown, we check for matches at [2]. What's with the syntax there? Why is `handledException` different from `exception`?

Well, certain call chains can result in messy `AggregateException`s with `InnerException`s, and writing predicates to match those `InnerException`s (including if nested) can be messy. So Polly provides [in-built `.HandleInner<TException>()` syntax](https://github.com/App-vNext/Polly/wiki/Handling-InnerExceptions-and-AggregateExceptions) to help. This line of code matches those exceptions, whether the user has configured `.HandleInner<>()` or straight `.Handle<>()` or a mixture:

```c#
Exception handledException = ExceptionPredicates.FirstMatchOrDefault(exception); // [2]
```

If Polly plucks a matching `InnerException` out of a messy `AggregateException` chain,   
`handledException` will be it. If Polly matches a plain non-inner exception, again, `handledException` will be it.

### Step 4: Add your custom functionality

#### aka: You hit the jackpot! Do your stuff ... then let's get outta here!

If your code hits [3] or [4], the policy has matched a result or exception it was configured to handle - code your custom logic for your policy here!

Finally, your custom policy has to decide how to exit, at [5] and [6].

To be clear, the policy could do anything you choose, as its exit - substitute a different result (as [Fallback policy](https://github.com/App-vNext/Polly/wiki/Fallback) does); rethrow a different exception; or just bubble the result or exception it was handling.

And also, you can build any structure you like within `ImplementationAsync(...)` - it doesn't have exactly to follow the form above. Polly's [Retry policy](https://github.com/App-vNext/Polly/wiki/Retry), for example, as you can guess, builds a loop.

In the logging policy, after we've logged, we'll exit by just returning the matched result or rethrowing the matched exception.

Here's a (near-final) implementation:

```c#
Func<Context, ILogger> LoggerProvider { get; }  // [a]
Action<ILogger, Context, DelegateResult<TResult>> LogAction { get; } // [b]

protected override async Task<TResult> ImplementationAsync(
    Func<Context, CancellationToken, Task<TResult>> action, 
    Context context, 
    CancellationToken cancellationToken,
    bool continueOnCapturedContext)
{
    try
    {
        TResult result = await action(context, cancellationToken).ConfigureAwait(continueOnCapturedContext);

        if (!ResultPredicates.AnyMatch(result))
        {
            return result; // Not an outcome the policy handles - just return it.
        }

        ILogger logger = LoggerProvider(context); // [a]
        LogAction(logger, context, new DelegateResult<TResult>(result)); // [b]

        // The policy intentionally bubbles the result outwards after logging.
        return result; // [c]
    }
    catch (Exception exception)
    {
        Exception handledException = ExceptionPredicates.FirstMatchOrDefault(exception);
        if (handledException == null)
        {
            throw; // Not an exception the policy handles - propagate the exception.
        }
        
        ILogger logger = LoggerProvider(context); // [a]
        LogAction(logger, context, new DelegateResult<TResult>(exception)); // [b]
        
        // The policy intentionally bubbles the exception outwards after logging.
        handledException.RethrowWithOriginalStackTraceIfDiffersFrom(exception); // [d]
        throw; // [d]
    }
}
```

At [c], the policy returns the result it just handled.

The lines marked [d] show some special syntax for rethrowing an exception preserving the original call stack, when Polly's predicates have worked their magic to match an `InnerException` (as described earlier).

What about the lines marked [a] and [b], where we do the actual logging?

We opted to let the user provide [a] a `Func<Context, ILogger>` to specify the logger. Why? Well, policies are typically (particularly with HttpClientFactory) configured in the `StartUp` file. On the other hand, loggers in .NET Core *local to the particular component* are usually only resolved at the call site by DI - for instance, a Controller class might take an `ILogger<FooController>` by constructor injection.

The `Func<Context, ILogger> loggerProvider` allows the user to bridge this, by providing a `Func` to select the logger at execution time. `Polly.Context` is an execution-scoped context which travels with every Polly execution, and has dictionary-like semantics - users can attach any information they like to it, to pass into the execution. The [worked example at the end of this blog post](TO LINK) shows how we'll pass the local `ILogger` instance in to the call in practice; and the Polly wiki covers the general technique [here](https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory#use-case-exchanging-information-between-policy-execution-and-calling-code).

*Note that the complexity here around obtaining an instance of `ILogger` is a factor of the split between early-binding to create the policy on HttpClientFactory and .NET Core's preference for category-specific `ILogger<TCategory>` resolved in a late-binding manner by DI*, usually by constructor injection into the relevant component. This complexity is a feature of these dimensions of logging in .NET Core rather than Polly *per se*. An alternative, simpler approach would replace [a] with a simple `ILogger`, and use the overloads described [here](https://github.com/App-vNext/Polly/wiki/Polly-and-HttpClientFactory#configuring-policies-to-use-services-registered-with-di-such-as-iloggert) to configure the policy with a fixed `ILogger<TFixed>` at startup.

To log to the logger, we chose [b] an `Action<ILogger, Context, DelegateResult<TResult>>`. You'll be getting the picture here: It's good practice to make `Context` an input parameter to any delegate you let users configure on a policy. We can let the user attach some custom data to `Context` which they want to log (or in your own custom policy, use `Context` information to influence policy operation some other way). And, in-built, `Context` carries [metadata about the Polly execution](https://github.com/App-vNext/Polly/wiki/Keys-And-Context-Data) which can be useful for logging - which Policy is in use, which PolicyWrap, and a CorrelationId for the execution.

Finally, `DelegateResult<TResult>` is a [discriminated union](https://github.com/reisenberger/Polly/blob/72c55eabd10c11f5820c4d9742a82313a846cd13/src/Polly.Shared/DelegateResult.cs) representing either:

- `DelegateResult<TResult>.Exception` - the exception the underlying execution threw (or null, if not)
- `DelegateResult<TResult>.Result` - the result the underlying execution returned.

### Step 5: Add configuration syntax

Finally, add some configuration syntax so that users can create instances of your policy!

The policy constructor will need to take the parameters:

```c#
Func<Context, ILogger> LoggerProvider { get; }  // [a]
Action<ILogger, Context, DelegateResult<TResult>> LogAction { get; } // [b]
```

However, for a **reactive** policy, users will configure the policy with syntax something like:

```c#
Action<ILogger, Context, DelegateResult<HttpResponseMessage>> logAction = (logger, context, outcome) => 
{
    logger.LogError("The call resulted in outcome: {happened}", outcome.Exception?.Message ?? outcome.Result.StatusCode.ToString());
}

Policy<HttpResponseMessage>
    .Handle<HttpRequestException>()
    .OrResult((int)response.StatusCode >= 500 || response.StatusCode == HttpStatusCode.RequestTimeout)
    .AsyncLog(ctx => ctx.GetLogger(), logAction);
```

Or with HttpClientFactory:

```c#
Action<ILogger, Context, DelegateResult<HttpResponseMessage>> logAction = (logger, context, outcome) => 
{
    logger.LogError("The call resulted in outcome: {happened}", outcome.Exception?.Message ?? outcome.Result.StatusCode.ToString());
}

services.AddHttpClient<FooClient>()
    .AddTransientHttpErrorPolicy(policy => policy.AsyncLog(ctx => ctx.GetLogger(), logAction));
```

How do we make `.AsyncLog(...)` follow on from the various `.Handle<>()` and `.Or...()` clauses? The answer is that handle clauses such as:

```c#
Policy<HttpResponseMessage>
    .Handle<HttpRequestException>()
    .OrResult((int)response.StatusCode >= 500 
       || response.StatusCode == HttpStatusCode.RequestTimeout);
```

return an instance of a special builder type, `PolicyBuilder<TResult>`, which encapsulates the choices the user has made about exceptions and results to handle. So the `.AsyncLog(...)` overload must be coded as an extension method on this class. Shown combined with the constructor, the pattern looks like this:

```c#
public static class LoggingPolicySyntax
{
    public static AsyncLoggingPolicy<TResult> AsyncLog<TResult>(
      this PolicyBuilder<TResult> policyBuilder, // [i]
      Func<Context, ILogger> loggerProvider, // [a]
      Action<ILogger, Context, DelegateResult<TResult>> logAction // [b]
      )
        {
            return new AsyncLoggingPolicy<TResult>(
                policyBuilder, // [i]
                loggerProvider,
                logAction
            );
        }
}

public class AsyncLoggingPolicy<TResult> : AsyncPolicy<TResult>
{
    private readonly Func<Context, ILogger> _loggerProvider; // [a]
    private readonly Action<ILogger, Context, DelegateResult<TResult>> _logAction; // [b]

    internal AsyncLoggingPolicy(
        PolicyBuilder<TResult> policyBuilder, // [i]
        Func<Context, ILogger> loggerProvider,
        Action<ILogger, Context, DelegateResult<TResult>> logAction)
            : base(policyBuilder)  // [ii]
        {
            _loggerProvider = loggerProvider ?? throw new NullReferenceException(nameof(loggerProvider));
            _logAction = logAction ?? throw new NullReferenceException(nameof(logAction));
        }
 
    /* rest of policy implementation as before */

}
```

The `policyBuilder` instance [i] should be passed down to Polly's `AsyncPolicy<TResult>` base class constructor (as shown at [ii]), so that the `ExceptionPredicates` and `ResultPredicates` properties can be configured on the policy. These also support Polly's [`.ExecuteAndCaptureAsync(...)` syntax](https://github.com/App-vNext/Polly/blob/master/README.md#post-execution-capturing-the-result-or-any-final-exception).

## Let's take it for a spin!

Let's take the new `AsyncLoggingPolicy<TResult>` for a spin!

The below example includes a number of classes which feature in the [Github repo](https://github.com/Polly-Contrib/Polly.Contrib.LoggingPolicy) for this policy:

- `Program.cs`: example program configuring an `AsyncLoggingPolicy<HttpResponseMessage>` using `HttpClientFactory`
- `ContextExtensions.cs`: helper methods on the `Polly.Context` class, to make selection of `ILogger` at runtime easier
- `FooClient.cs`: a typed client configured by `HttpClientFactory`
- `StubErroringDelegatingHandler.cs`: a delegating handler also configured by `Program.cs` within `FooClient`, to randomly generate errors - just to give the `LoggingPolicy<T>` some errors for us to log in this demonstration!

```c#
using Microsoft.Extensions.Logging;

namespace Polly.Contrib.LoggingPolicy
{
    /// <summary>
    /// Defines extension methods on <see cref="Polly.Context"/> for registering and retrieving instances of <see cref="ILogger"/>.
    /// </summary>
    public static class ContextExtensions
    {
        private static readonly string LoggerKey = $"{nameof(LoggingPolicy)}.Logger";

        /// <summary>
        /// Registers a <see cref="ILogger"/> on the Polly execution <see cref="Context"/>, so that a policy from <see cref="Polly.Contrib.LoggingPolicy"/>
        /// can retrieve it using the <see cref="GetLogger"/> method.
        /// </summary>
        /// <param name="context">The Polly execution context.</param>
        /// <param name="logger">The logger to register on the execution context.</param>
        /// <returns>The Polly execution <see cref="Context"/>, for fluent chaining.</returns>
        public static Context WithLogger(this Context context, ILogger logger)
        {
            context[LoggerKey] = logger;
            return context;
        }

        /// <summary>
        /// Retrieves a <see cref="ILogger"/> previously registered on the Polly execution <see cref="Context"/>
        /// using the <see cref="WithLogger"/> method.
        /// </summary>
        /// <param name="context">The Polly execution context.</param>
        /// <returns>The <see cref="ILogger"/>; or null, if none was registered.</returns>
        public static ILogger GetLogger(this Context context)
        {
            if (context.TryGetValue(LoggerKey, out object logger))
            {
                return logger as ILogger;
            }

            return null;
        }
    }
}
```

```c#
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Contrib.LoggingPolicy;

namespace ConsoleAppExampleForBlogPost
{
    public class FooClient
    {
        private readonly ILogger logger;
        private readonly HttpClient client;

        public FooClient(ILogger<FooClient> logger, HttpClient client)
        {
            this.logger = logger;
            this.client = client;
        }

        public async Task<string> GetStringAsync(string url, CancellationToken token)
        {
            var context = new Context { ["url"] = url }.WithLogger(logger);
            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url);
            request.SetPolicyExecutionContext(context);

            var response = await client.SendAsync(request, token);

            return await response.Content.ReadAsStringAsync();
        }
    }
}
```

```c#
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Contrib.LoggingPolicy;

namespace ConsoleAppExampleForBlogPost
{
    class Program
    {
        static async Task Main(string[] args)
        {
            IServiceCollection services = new ServiceCollection();

            services.AddLogging(configure => configure.AddConsole());

            void LogAction(ILogger logger, Context context, DelegateResult<HttpResponseMessage> outcome)
            {
                // This logging can be as sophisticated as you like; this is a simple example to illustrate principles.
                string url = context.GetValueOrDefault("url").ToString() ?? "[unknown]";
                string happened = outcome.Exception?.Message ?? outcome.Result.StatusCode.ToString();
                logger?.LogInformation($"{url}: {happened}");
            }

            services.AddHttpClient<FooClient>()
                
                // Whatever standard resilience logic you want.
                .AddTransientHttpErrorPolicy(policy => policy.RetryAsync(5))
                
                // Logging policy to log transient faults as they occur.
                // The logging policy is inside the retry policy, so will log faults from each try, before they are retried.
                .AddTransientHttpErrorPolicy(policy => policy.AsyncLog(ctx => ctx.GetLogger(), LogAction))
                
                // For this test example we add a stub DelegatingHandler which will manufacture faults for us.
                .AddHttpMessageHandler(() => new StubErroringDelegatingHandler());


            // Quickly test our FooClient.
            var fooClient = services
                .BuildServiceProvider()
                .GetRequiredService<FooClient>();

            string result = await fooClient.GetStringAsync("https://www.google.com", default(CancellationToken));

            Console.WriteLine($"Got result: {result}");

            Console.ReadKey();
        }
    }
}
```

```c#
using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace ConsoleAppExampleForBlogPost
{
    public class StubErroringDelegatingHandler : DelegatingHandler
    {
        private readonly Random random;

        public StubErroringDelegatingHandler()
        {
            random = new Random();
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            switch (random.Next(3))
            {
                case 1:
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError));
                case 2:
                    throw new HttpRequestException();

                default:
                    return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK){Content = new StringContent("Dummy content from the stub helper class.")});
            }
        }
    }
}
```

Here's some example output:

```
info: System.Net.Http.HttpClient.FooClient.LogicalHandler[100]
      Start processing HTTP request GET https://www.google.com/
info: ConsoleAppExampleForBlogPost.FooClient[0]
      https://www.google.com: InternalServerError
info: ConsoleAppExampleForBlogPost.FooClient[0]
      https://www.google.com: Exception of type 'System.Net.Http.HttpRequestException' was thrown.
info: ConsoleAppExampleForBlogPost.FooClient[0]
      https://www.google.com: InternalServerError
info: ConsoleAppExampleForBlogPost.FooClient[0]
      https://www.google.com: Exception of type 'System.Net.Http.HttpRequestException' was thrown.
info: ConsoleAppExampleForBlogPost.FooClient[0]
      https://www.google.com: Exception of type 'System.Net.Http.HttpRequestException' was thrown.
info: System.Net.Http.HttpClient.FooClient.LogicalHandler[101]
      End processing HTTP request after 47.3552ms - OK
Got result: Dummy content from the stub helper class.
```

Note that this output includes some default logging from `HttpClient` as well as that provided by `AsyncLoggingPolicy<TResult>`.

### Where can I get the code?

The full source code for `AsyncLoggingPolicy<TResult>` and the test console app is available in [this Github repo](https://github.com/Polly-Contrib/Polly.Contrib.LoggingPolicy).

## Where next?

### Grab the template

If you want to dive straight in to experimenting with a custom policy, just grab the [template repo](https://github.com/Polly-Contrib/Polly.Contrib.CustomPolicyTemplates) and start copy/paste/rename/extend-ing the classes.

### Authoring a proactive custom policy

If you haven't already looked at it, [Part II](/2019/02/13/authoring-a-proactive-polly-policy-custom-policies-part-ii.html) covers authoring a *proactive* custom policy. The example chosen captures execution timing for any execution through the policy.

### Understanding other forms of Polly policy

[Part IV](/2019/02/13/custom-policies-for-all-execution-types-custom-policies-part-iv.html) looks at how to author other forms of policy - synchronous policies and non-generic policies - in the most efficient manner.
