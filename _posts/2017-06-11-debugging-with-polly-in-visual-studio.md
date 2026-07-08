---
layout: post
title: "Debugging with Polly in Visual Studio"
author: Dylan Reisenberger
date: 2017-06-11
---

## Overview

When you define a Polly exception-handling policy, the policy will internally catch matched exceptions and handle them as the policy defines: orchestrate a retry; update circuit-breaker statistics; or channel execution to a fallback.

Debugging such executions can however be noisy in Visual Studio: commonly-used settings cause Visual Studio to break on *each* exception the policy handles.

This article describes how a better experience debugging with Polly in the mix can be achieved by configuring Visual Studio debugger settings to break on **Just My Code**, to continue on so-called **user-unhandled exceptions**, and by specifying whether to break depending on **which module throws the exception**.

## Understanding the debug setting: Just My Code

First, you likely want to set the debug setting '[Just My Code](https://web.archive.org/web/20250318081126/https://docs.microsoft.com/en-gb/visualstudio/debugger/just-my-code)'.

![[Visual Studio debugger configuration option: Just My Code]](https://web.archive.org/web/20250318081126im_/https://docs.microsoft.com/en-gb/visualstudio/debugger/media/dbg_justmycode_options.png)

*(image via [https://docs.microsoft.com/en-gb/visualstudio/debugger/just-my-code](https://web.archive.org/web/20250318081126/https://docs.microsoft.com/en-gb/visualstudio/debugger/just-my-code))*

This tells the VS debugger that you don't want to step through the code of the .NET implementation, nor of third party libraries you may be using - this includes Polly and third-party libraries you might be calling through Polly.

## Configuring the debugger for 'User-unhandled' exceptions

### What is 'User-unhandled'?

Next, we need to unpack what Visual Studio means by a **User-unhandled exception**. The Visual Studio Debugger may break for an exception, saying it is **user-unhandled**:

![[Dialog showing Visual Studio breaking on user-unhandled exception]](https://web.archive.org/web/20250318081126im_/https://docs.microsoft.com/en-gb/visualstudio/debugger/media/exceptionunhandledbyuser.png)

*(image via [https://docs.microsoft.com/en-gb/visualstudio/debugger/managing-exceptions-with-the-debugger](https://web.archive.org/web/20250318081126/https://docs.microsoft.com/en-gb/visualstudio/debugger/managing-exceptions-with-the-debugger))*

Many have commented that Visual Studio's terminology **user-unhandled** is confusing.

- It does not mean the exception is unhandled.
- It also does not mean your user code won't handle the exception (once code flow has been allowed to continue, via the debugger controls).

Rather, the debugger may break saying an exception is **user-unhandled** *if the exception is **first** handled by non-user code*. *Reference*: [https://blogs.msdn.microsoft.com/visualstudioalm/2015/01/07/understanding-exceptions-while-debugging-with-visual-studio/](https://web.archive.org/web/20250318081126/https://blogs.msdn.microsoft.com/visualstudioalm/2015/01/07/understanding-exceptions-while-debugging-with-visual-studio/).

### The debugger breaks by default on 'User-unhandled' exceptions

If an exception is going to be handled by non-user code (for example a Polly policy), why then does the debugger (by default) break for it?

It does this (per MSDN) so that you still have a chance to *see* the exception at source where it occurred - it is an exception, after all.

However, this behaviour is what can make step-debugging with Polly noisy. For instance, if you have five retries configured and all fail, step-debugging this will break all six times (first try and five retries) the exception is thrown.

## Taming the Visual Studio debugger

To reduce the noise when step-debugging exceptions handled by a Polly policy, in both Visual Studio 2015 and 2017 you can adjust debugging settings to specify that you do not want to break when a given exception type is 'user-unhandled'.

[Follow the instructions here to not break when a specific exception is user-unhandled (ie handled by Polly) in Visual Studio 2015](https://web.archive.org/web/20250318081126/https://blogs.msdn.microsoft.com/visualstudioalm/2015/02/23/the-new-exception-settings-window-in-visual-studio-2015/), section **Using the Context Menu**

[Follow the instructions here to not break when a specific exception is user-unhandled (ie handled by Polly) in Visual Studio 2017](https://web.archive.org/web/20250318081126/https://docs.microsoft.com/en-gb/visualstudio/debugger/managing-exceptions-with-the-debugger), section **Tell the debugger to continue on user-unhandled exceptions**

For example, when using a Polly policy to handle `System.Io.IoException`, you might specify not to break when this is 'user-unhandled' (as we learnt above, this includes 'handled by Polly').

This approach can have limitations, in that you might want the debugger not to break on `IoException`s on *that* particular code path; but you might still want it to break if those exceptions are thrown elsewhere. Visual Studio 2015 does not give you that level of control, but Visual Studio 2017 comes closer to doing so. With Visual Studio 2017, you can specify to break or not break according to conditions: for example according to which module is throwing.

![[Dialog showing configuring Visual Studio 2017 conditions for breaking on an exception]](https://web.archive.org/web/20250318081126im_/https://docs.microsoft.com/en-gb/visualstudio/debugger/media/dbg-conditional-exception.png)

*Image via [https://docs.microsoft.com/en-gb/visualstudio/debugger/managing-exceptions-with-the-debugger](https://web.archive.org/web/20250318081126/https://docs.microsoft.com/en-gb/visualstudio/debugger/managing-exceptions-with-the-debugger): Follow the instructions under **Add conditions to an exception***

If for example you are using Polly to handle exceptions thrown by a third-party library or particular `System.*.dll`, you could use Visual Studio's fine control to specify that the debugger should not break when the exception is thrown by that library. However, if the exception was unexpectedly thrown elsewhere in *your* code, the debugger would continue to break.

## Earlier VS versions: The `[DebuggerNonUserCode]` attribute

Another option to smooth debugging in earlier versions of Visual Studio is to specify that certain code is `[DebuggerStepThrough]` or `[DebuggerNonUserCode]`. One intended effect was that the debugger would not break on exceptions in code marked with these attributes. Polly's `.Execute(...)` overloads are marked with this attribute for this reason.

As [this issue explored](https://web.archive.org/web/20250318081126/https://github.com/App-vNext/Polly/issues/185), performance changes in Visual Studio 2015 meant [this no longer worked](https://web.archive.org/web/20250318081126/https://blogs.msdn.microsoft.com/visualstudioalm/2016/02/12/using-the-debuggernonusercode-attribute-in-visual-studio-2015/) out of the box - but can be re-enabled with registry hacks.

We have not yet verified whether Visual Studio 2017 reverts to the original behaviour of not breaking on `[DebuggerStepThrough]` or `[DebuggerNonUserCode]`, or still requires the registry hack.

## Second-chance and unhandled exceptions

Breaking on a 'first-chance' (or user-unhandled first-chance) exception means that the debugger breaks at the first chance after the exception is thrown (if configured to do so), even if you do have a `try/catch` that will handle that exception.

For completeness, an exception *not* handled by a `try/catch` is known as a 'second-chance' or 'last-chance' exception. If there is no code handling for 'second-chance' or 'last-chance' exceptions, the debugger [will *always* break on them](https://web.archive.org/web/20250318081126/https://blogs.msdn.microsoft.com/visualstudioalm/2015/01/07/understanding-exceptions-while-debugging-with-visual-studio/).
