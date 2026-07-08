---
layout: page
title: "The elevator pitch: Who or what is Polly?"
---

![The elevator pitch: Who or what is Polly?](/assets/images/2016/09/Blue-Beak-Parrot.png)

## Don't let the parrot fool you!

Polly is not some colorful and chatty avifauna perched atop the shoulder of some scurvy knave! It has nothing to do with wildlife or nautical personalities, but everything to do with keeping your .NET code fault-tolerant and resilient, particularly when communicating with external services.

Today's cloud application, mobile, data-streaming, and IoT technologies all depend vitally on reliable connectivity. But underlying systems can fail, and networks are notoriously fickle: outages, latency, transient blips, spikes in load - all challenge 100% reliability.

Polly helps you navigate the unreliable network. By providing resilience strategies in fluent-to-express policies such as Retry, WaitAndRetry, and CircuitBreaker, Polly can help you reduce fragility, and keep your systems and customers connected. Example usages are fault-tolerance for any distributed systems and inter-process calls, such as WCF, RESTful calls between microservices, calls to cloud services, Internet of Things (IoT) connectivity, messaging systems, calls to your persistence layer (eg. wrapping Entity Framework), etc.

While there are other frameworks for .NET that include a circuit-breaker, Polly is the only comprehensive resilience framework for in this space. The closest comparison is Netflix's [Hystrix](https://github.com/Netflix/Hystrix/wiki) project, built on the Java platform. However, we plan on taking Polly beyond what Hystrix provides, but targeted specifically to the .NET framework.

An ambitious [roadmap](https://github.com/App-vNext/Polly/wiki/Polly-Roadmap) targets policies for bulkhead isolation, timeouts, caching, fallback and load-shedding, preventing catastrophic failure for systems under load. Bulkhead isolation is interesting in that it prevents runaway faults from swamping systems, by grouping operations to isolated resource pools.

Best of all, Polly is a zero-dependency, lightweight library that can work anywhere .NET can run. Whether you’re building an occasionally connected mobile application, or a heavy duty business intelligence service, simply drop in the [Polly NuGet package](https://www.nuget.org/packages/Polly/) and get started right away!
