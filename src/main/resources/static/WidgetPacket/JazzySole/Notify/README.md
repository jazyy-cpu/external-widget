# JazzySole Notify

Sliding notifications for UWA widgets.

| File | |
|---|---|
| `Notify.js` | AMD module `JazzySole/Notify` 1.0.0 |
| `Notify.css` | placement and the slide - everything else is Bootstrap |

## The rule it exists to enforce

**How long a message stays is decided by its type, in one table, and a caller
may override it for a single message.**

| Type | Bootstrap style | Stays | Meaning |
|---|---|---|---|
| `critical` | danger | **until the user closes it** | something the user must acknowledge |
| `error` | danger | **until the user closes it** | an operation failed |
| `warning` | warning | 5 s | worth knowing, not worth blocking on |
| `success` | success | 5 s | it worked |
| `info` | info | 5 s | the default |

`timeout: 0` is what "the user must close it" means, and a message that can
never time out is **always** given a close button, whatever the caller asked -
otherwise it would be permanent.

The table is in one place on purpose. When someone decides warnings should last
eight seconds, that is one number, and every widget follows.

## Install

```html
<link rel="stylesheet" type="text/css" href="../JazzySole/Notify/Notify.css" />
<script type="text/javascript" src="../JazzySole/Notify/Notify.js"></script>
```

## Use

```js
define('MyWidget/Thing', ['JazzySole/Notify'], function (Notify) {
    Notify.success('Project saved.');
    Notify.warning('Two attachments were skipped.');
    Notify.critical('The project was deleted by someone else. Reload before editing.');

    // an override wins over the type's own time
    Notify.info('Copied to the clipboard.', { timeout: 1500 });
    Notify.warning('Read this one properly.', { timeout: 0 });   // now it waits for a click

    // the long form
    var handle = Notify.show({
        type: 'error',
        title: 'Could not save',
        message: err.message
    });
    handle.close();          // close it from code, e.g. when a retry succeeds
});
```

An auto-closing message **pauses while the pointer is over it**, so reading
takes as long as it takes.

## API

| Member | |
|---|---|
| `show(input)` | `input` is a message string, or `{ type, message, title, timeout, dismissible }`. Returns `{ close(), element, settings }` |
| `critical(msg, opts)` `error` `warning` `success` `info` | shorthands for `show` |
| `dismissAll()` | close everything on screen |
| `count()` | how many are on screen |
| `configure(options)` | `{ types, max, position }` - change the policy once for the whole application |
| `types()` | the policy in force, as a copy |
| `VERSION` | `1.0.0` |
| `_resolve` | tests only |

### configure

```js
Notify.configure({
    types: { warning: { timeout: 8000 } },   // merged, not replaced
    max: 6,                                  // beyond this the oldest closable one goes
    position: 'bottom-start'                 // top-end (default) | top-start | bottom-end | bottom-start
});
```

`types` accepts a name that does not exist yet, so a widget can add its own
severity without editing the library.

## Behaviour worth knowing

- **The stack hangs off `document.body`, not `widget.body`.** A widget clears
  `widget.body` whenever it re-renders a page, which would silently wipe a
  message the user has not read. The stack is a fixed overlay inside the
  widget's own iframe document, so it survives a re-render and never leaves the
  frame.
- **No Bootstrap JavaScript** (UWA rule C7: its bundle is UMD and breaks the AMD
  loader). The box is Bootstrap's `alert`; the sliding and the placement are the
  only custom CSS, and they are scoped to `.jz-notify-*`.
- At most `max` messages are on screen. Over that, the oldest **closable** one
  goes first, so a critical message is not pushed out by chatter.
- `prefers-reduced-motion` turns the slide into a plain fade.
- `role="alert"` and `aria-live="assertive"` for critical and error;
  `role="status"` and `polite` for the rest.

## What it is not for

A notification is for an **event** - something just happened. The state of a
page (this project could not be loaded, this list is empty, this filter was
refused) belongs in the page, as an inline `alert`, because it is still true
after five seconds.

## Tested

`src/test/js/jazzysole-notify.test.js` - the policy, without a browser:
type defaults, the override, `0` meaning sticky, a sticky message always being
closable, an unknown type falling back to `info`, a string argument, and
`configure` merging rather than replacing. The sliding and the placement are
checked in the browser.

## Change log

| Version | Date | |
|---|---|---|
| 1.0.0 | 2026-09-24 | first version, written for the WGT-04 project detail page |
