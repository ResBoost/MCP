# Resboost brand assets

These assets extend the existing teal `r.` mark used in the repository banners.
The logos have transparent backgrounds and outlined lettering, so they do not
require an installed font.

| Asset | Use |
| --- | --- |
| [banner-light.svg](banner-light.svg), [banner-dark.svg](banner-dark.svg) | Repository banners for light and dark themes |
| [resboost-logo.svg](resboost-logo.svg) | Horizontal logo for light backgrounds |
| [resboost-logo-dark.svg](resboost-logo-dark.svg) | Horizontal logo for dark backgrounds |
| [resboost-mark.svg](resboost-mark.svg) | Scalable square mark |
| [resboost-mark.png](resboost-mark.png) | 512 × 512 square mark |
| [favicon.svg](favicon.svg) | Scalable browser icon |
| [favicon.ico](favicon.ico) | Browser fallback containing 16, 32 and 48 px icons |
| [favicon-16.png](favicon-16.png), [favicon-32.png](favicon-32.png), [favicon-48.png](favicon-48.png) | Individual browser icon sizes |
| [apple-touch-icon.png](apple-touch-icon.png) | 180 × 180 home screen icon |

The primary teal is `#087f82`; the dark-background wordmark uses `#5cc8c1`.
Keep the logos' aspect ratios and surrounding clear space when resizing.

To use the icons on a website, copy the favicon files and touch icon into its
public root and add:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
```

This repository contains the MCP server source, rather than the website's page
layout. The icons are provided here for reuse in the Resboost app.

The Resboost name and logo remain Resboost's brand assets; see the repository's
[licence note](../README.md#licence).
