---
layout: post
title: "Policy recommendations for Azure Cognitive Services"
author: Joel Hulen
date: 2018-03-06
---

![Policy recommendations for Azure Cognitive Services](/assets/images/2018/03/Polly-Heart-Cognitive-1.png)

[Azure Cognitive Services](https://web.archive.org/web/20250318065129/https://azure.microsoft.com/services/cognitive-services/) is an excellent series of cloud-based APIs that open up a world of artificial intelligence (AI) opportunities that you can easily add to your applications and data process flow. Each service contains a set of trained and field-tested machine learning models that are continuously retrained for greater accuracy over time. Using these Cognitive Services models is as simple as making a REST call, which can be invoked from any application or process that is able to do so. [Read more](https://web.archive.org/web/20250318065129/https://docs.microsoft.com/azure/architecture/data-guide/technology-choices/cognitive-services) about the available services.

### The challenge

Like most public APIs, Cognitive Services invokes rate limiting for your requests, depending on the pricing plan you choose.

![Azure Cognitive Services pricing plans showing rate limits](/assets/images/2018/03/Cognitive-Services-pricing-plans.png)

The above screen capture shows the available pricing tiers for the Computer Vision API. **F0 - Free** is limited to 20 calls per minute, while **S1 - Standard** is limited to 10 calls per second.

The challenge here is obvious: you can easily hit these rate limits during busy periods of traffic, or when batch processing many items that result in multiple calls to the API within a short time frame. There are two ways to approach this challenge. The first is by being **proactive**, and throttle requests to the API from your application. The second approach is **reactive**. This means that you alter your application or process to slow down or pause requests to allow the service to recover.

Polly currently has a [Rate-limit Policy](https://web.archive.org/web/20250318065129/https://github.com/App-vNext/Polly/wiki/Polly-Roadmap#rate-limit-policy) on the road map. There is currently no plan to create this policy (we could use your help!), but the road map link above does refer to a couple of different options for doing this yourself. Because of this, we'll focus on the reactionary approach, and one way you can create and use a resiliency strategy through the combination of a couple of different policies.

### The environment

In this example, I have created an [Azure Function](https://web.archive.org/web/20250318065129/https://docs.microsoft.com/azure/azure-functions/functions-overview) that is triggered whenever a photo is uploaded to an Azure [Blob Storage](https://web.archive.org/web/20250318065129/https://docs.microsoft.com/azure/storage/blobs/storage-blobs-introduction) container. If you've not heard of or used Azure Functions, I highly recommend looking into it further. I've been diving head-first into serverless lately, and I believe there are a lot of great capabilities around this space. The most interesting aspect about serverless (though there are still servers in play) is how you only pay for what you use. Azure Functions, as opposed to standard App Services, uses sub-second billing on the [consumption plan](https://web.archive.org/web/20250318065129/https://docs.microsoft.com/azure/azure-functions/functions-overview#pricing). This means you only pay for when the function is used, rather than paying a monthly fee for the privilege of being able to use it. Another benefit is its ability to automatically scale out to n-number of servers to meet demand, all without any configuration on my part. After the deluge of requests subside, the function will scale back to zero servers, or however are needed for incoming requests.

The purpose of my function is to perform an object character recognition (OCR) process on each uploaded image as it is added to the storage container. To do this, I am using the [Computer Vision API](https://web.archive.org/web/20250318065129/https://docs.microsoft.com/en-us/azure/cognitive-services/computer-vision/home) Cognitive Service.

Below is a diagram of my overall solution. We will just be focusing on the left-hand side for this post:

![Architecture diagram for Blob Storage, Azure Functions, and Computer Vision API](/assets/images/2018/03/Polly-resiliency-Functions-Cognitive-Services.png)

### Creating a resiliency policy with Polly

Let's start with the overall resiliency policy, then work backwards from there. There are two policies we'll use a Retry policy ([wait and retry](https://web.archive.org/web/20250318065129/https://github.com/App-vNext/Polly#wait-and-retry)), and a [Circuit Breaker](https://web.archive.org/web/20250318065129/https://github.com/App-vNext/Polly#circuit-breaker) policy. Because we want these two policies to work together, we'll use a [PolicyWrap](https://web.archive.org/web/20250318065129/https://github.com/App-vNext/Polly#policywrap) to combine them.

The method below creates a Polly-based resiliency strategy that does the following when communicating with the external (downstream) Computer Vision API service:

If requests to the service are being throttled, as indicated by 429 or 503 responses, and try again in a bit by exponentially backing off each time. This should give the service time to recover or allow enough time to pass that removes the throttling restriction. is implemented through the `WaitAndRetry` policy named **waitAndRetryPolicy**.

Alternately, if requests to the service result in an `HttpResponseException`, or a number of codes worth retrying (such as 500, 502, or 504), break the circuit to block any more for the specified period of time, send a test request to see if the error is still occurring, then reset the circuit once successful.

These policies are executed through the `PolicyWrap` policy that is returned by the method.

```
/// <summary>
/// Creates a Polly-based resiliency strategy that helps deal with transient faults when communicating
/// with the external (downstream) Computer Vision API service.
/// </summary>
/// <returns></returns>
private PolicyWrap<HttpResponseMessage> DefineAndRetrieveResiliencyStrategy()  
{
    // Retry when these status codes are encountered.
    HttpStatusCode[] httpStatusCodesWorthRetrying = {
       HttpStatusCode.InternalServerError, // 500
       HttpStatusCode.BadGateway, // 502
       HttpStatusCode.GatewayTimeout // 504
    };

    // Define our waitAndRetry policy: retry n times with an exponential backoff in case the Computer Vision API throttles us for too many requests.
    var waitAndRetryPolicy = Policy
        .HandleResult<HttpResponseMessage>(e => e.StatusCode == HttpStatusCode.ServiceUnavailable ||
            e.StatusCode == (System.Net.HttpStatusCode)429)
        .WaitAndRetryAsync(10, // Retry 10 times with a delay between retries before ultimately giving up
            attempt => TimeSpan.FromSeconds(0.25 * Math.Pow(2, attempt)), // Back off!  2, 4, 8, 16 etc times 1/4-second
                                                                          //attempt => TimeSpan.FromSeconds(6), // Wait 6 seconds between retries
            (exception, calculatedWaitDuration) =>
            {
                _log.Info($"Computer Vision API server is throttling our requests. Automatically delaying for {calculatedWaitDuration.TotalMilliseconds}ms");
            }
        );

    // Define our first CircuitBreaker policy: Break if the action fails 4 times in a row.
    // This is designed to handle Exceptions from the Computer Vision API, as well as
    // a number of recoverable status messages, such as 500, 502, and 504.
    var circuitBreakerPolicyForRecoverable = Policy
        .Handle<HttpResponseException>()
        .OrResult<HttpResponseMessage>(r => httpStatusCodesWorthRetrying.Contains(r.StatusCode))
        .CircuitBreakerAsync(
            handledEventsAllowedBeforeBreaking: 3,
            durationOfBreak: TimeSpan.FromSeconds(3),
            onBreak: (outcome, breakDelay) =>
            {
                _log.Info($"Polly Circuit Breaker logging: Breaking the circuit for {breakDelay.TotalMilliseconds}ms due to: {outcome.Exception?.Message ?? outcome.Result.StatusCode.ToString()}");
            },
            onReset: () => _log.Info("Polly Circuit Breaker logging: Call ok... closed the circuit again"),
            onHalfOpen: () => _log.Info("Polly Circuit Breaker logging: Half-open: Next call is a trial")
        );

    // Combine the waitAndRetryPolicy and circuit breaker policy into a PolicyWrap. This defines our resiliency strategy.
    return Policy.WrapAsync(waitAndRetryPolicy, circuitBreakerPolicyForRecoverable);
}
```

**NOTE:** A longer-term resiliency strategy would have us share the circuit breaker state across instances, ensuring subsequent calls to the struggling downstream service from new instances adhere to the circuit state, allowing that service to recover. This could possibly be handled by a *Distributed Circuit Breaker* ([https://github.com/App-vNext/Polly/issues/287](https://web.archive.org/web/20250318065129/https://github.com/App-vNext/Polly/issues/287)) in the future, or perhaps by using [Durable Functions](https://web.archive.org/web/20250318065129/https://docs.microsoft.com/azure/azure-functions/durable-functions-overview) that can hold the state.

### Using the new resiliency policy

To use the policy, all we need to do is to `Execute` it, passing our `Action` to it:

```
// Execute the REST API call, implementing our resiliency strategy.
                HttpResponseMessage response = await resiliencyStrategy.ExecuteAsync(() => _client.PostAsync(uri, GetImageHttpContent(imageBytes)));
```

The `resiliencyStrategy` variable is the `PolicyWrap` policy returned by the `DefineAndRetrieveResiliencyStrategy` method shown in the previous section.

The `GetImageHttpContent` method is a static method used to request the `ByteArrayContent` object from the uploaded photo's image bytes. This helps prevent us from attempting to access a disposed object when the policy is throttled. Here's the method for context:

```
/// <summary>
/// Request the ByteArrayContent object through a static method so
/// it is not disposed when the Polly resiliency policy asynchronously
/// executes our method that posts the image content to the Computer
/// Vision API. Otherwise, we'll receive the following error when the
/// API service is throttled:
/// System.ObjectDisposedException: Cannot access a disposed object. Object name: 'System.Net.Http.ByteArrayContent'
/// 
/// More information can be found on the HttpClient class in the
/// .NET Core library source code:
/// https://github.com/dotnet/corefx/blob/6d7fca5aecc135b97aeb3f78938a6afee55b1b5d/src/System.Net.Http/src/System/Net/Http/HttpClient.cs#L500
/// </summary>
/// <param name="imageBytes"></param>
/// <returns></returns>
private static ByteArrayContent GetImageHttpContent(byte[] imageBytes)  
{
    var content = new ByteArrayContent(imageBytes);

    // Add application/octet-stream header for the content.
    content.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");

    return content;
}
```

To put it all together, here's the method that references and uses the resiliency policy, calling out to the Computer Vision API:

```
private async Task<string> MakeOCRRequest(byte[] imageBytes)  
{
    _log.Info("Making OCR request");
    var licensePlate = string.Empty;
    // Request parameters.
    const string requestParameters = "language=unk&detectOrientation=true";
    // Get the API URL and the API key from settings.
    // TODO 2: Populate the below two variables with the correct AppSettings properties.
    var uriBase = ConfigurationManager.AppSettings["computerVisionApiUrl"];
    var apiKey = ConfigurationManager.AppSettings["computerVisionApiKey"];

    var resiliencyStrategy = DefineAndRetrieveResiliencyStrategy();

    // Configure the HttpClient request headers.
    _client.DefaultRequestHeaders.Clear();
    _client.DefaultRequestHeaders.Accept.Clear();
    _client.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", apiKey);
    _client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

    // Assemble the URI for the REST API Call.
    var uri = uriBase + "?" + requestParameters;

    try
    {
        // Execute the REST API call, implementing our resiliency strategy.
        HttpResponseMessage response = await resiliencyStrategy.ExecuteAsync(() => _client.PostAsync(uri, GetImageHttpContent(imageBytes)));

        // Get the JSON response.
        var result = await response.Content.ReadAsAsync<OCRResult>();
        licensePlate = GetLicensePlateTextFromResult(result);
    }
    catch (BrokenCircuitException bce)
    {
        _log.Error($"Could not contact the Computer Vision API service due to the following error: {bce.Message}");
    }
    catch (Exception e)
    {
        _log.Error($"Critical error: {e.Message}", e);
    }

    _log.Info($"Finished OCR request. Result: {licensePlate}");

    return licensePlate;
}
```

Here is the Azure Function code. Note that it is triggered with a `BlobTrigger`, every time a new photo is uploaded to the Blob Storage container.

```
public static class ProcessImage  
{
    public static HttpClient _client;

    [FunctionName("ProcessImage")]
    public static async Task Run([BlobTrigger("images/{name}", Connection = "blobStorageConnection")]Stream incomingPlate, string name, TraceWriter log)
    {
        string licensePlateText = string.Empty;
        // Reuse the HttpClient across calls as much as possible so as not to exhaust all available sockets on the server on which it runs.
        _client = _client ??  new HttpClient();
        log.Info($"Processing {name}");

        try
        {
            byte[] licensePlateImage;
            // Convert the incoming image stream to a byte array.
            using (var br = new BinaryReader(incomingPlate))
            {
                licensePlateImage = br.ReadBytes((int)incomingPlate.Length);
            }
            // Set the licensePlateText value by awaiting a new FindLicensePlateText.GetLicensePlate method.
            licensePlateText = await new FindLicensePlateText(log, _client).GetLicensePlate(licensePlateImage);

            // Send the details to Event Grid.
            await new SendToEventGrid(log, _client).SendLicensePlateData(new LicensePlateData()
            {
                FileName = name,
                LicensePlateText = licensePlateText,
                TimeStamp = DateTime.UtcNow
            });
        }
        catch (Exception e)
        {
            log.Error(e.Message);
        }

        log.Info($"Finished processing. Detected the following license plate: {licensePlateText}");
    }
}
```

The following line within the function is where the `MakeOCRRequest` is invoked. I've omitted the `FindLicensePlateText` class for brevity.

```
licensePlateText = await new FindLicensePlateText(log, _client).GetLicensePlate(licensePlateImage);
```

### Watching the policy work its magic

I've instrumented my Azure Function App that holds my functions with [Application Insights](https://web.archive.org/web/20250318065129/https://azure.microsoft.com/services/application-insights/) so I can capture and view telemetry in real-time. Because it is asynchronous, it does not impact my solution's performance in any way.

Here is a screen capture of the Live Metrics Stream provided by my Application Insights instance, showing the results of my function making calls to the Computer Vision API (S1 - Standard pricing tier) while rapidly uploading 1,000 photos:

![Application Insights Live Metrics Stream](/assets/images/2018/03/Application-Insights-non-constrained.png)

I've highlighted key areas to observe. You will notice that the CPU usage is in line with the Request Rate, the average Request Duration stays between zero seconds and 500 milliseconds, and there are two servers that have been allocated to handle the function's demand.

Now, I've switched the Computer Vision API to the F0 - Free tier, which is constrained to **20 calls per minute**. Now observe the output of the Live Metrics Stream while rapidly uploading 1,000 photos, prompting our resiliency policy to kick into action:

![Application Insights Live Metrics Stream - resource-constrained](/assets/images/2018/03/Application-Insights-constrained.png)

After running for a couple of minutes, we start to notice a few things. The Request Duration will start to increase over time. As this happens, we notice more servers being brought online (11 in this case). Each time a server is brought online, you should see a message in the Sample Telemetry stating that it is "Generating 2 job function(s)", followed by a Starting Host message. We also see messages logged by the resiliency policy that the Computer Vision API server is throttling the requests. This is known by the response codes sent back from the service (429). A sample message is "Computer Vision API server is throttling our requests. Automatically delaying for 32000ms".

What has happened is, our resiliency policy detects the rate-limiting response codes being sent back from the Computer Vision API, then begins exponentially backing off requests to the Computer Vision API, allowing it to recover and lift the rate limit for the next available period of time. This intentional delay greatly increases the function's response time, thus causing the Consumption plan's dynamic scaling to kick in, allocating several more servers.

I hope this information is helpful as a more prescriptive way to handle a specific scenario, but can be more broadly applied to any service that imposes rate limits.
