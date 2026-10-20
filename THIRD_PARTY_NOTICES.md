# Third-party notices

Master Reader is free and open-source software. It contains code adapted from the
projects below, in accordance with their licenses.

## LNReader

Source adapters under `src/sources/` are ported from the LNReader plugin ecosystem.
Substantial portions of the parsing logic, selectors and source-specific quirks are
derived from those plugins.

- App: https://github.com/LNReader/lnreader
- Plugins: https://github.com/LNReader/lnreader-plugins
- License: MIT

```
MIT License

Copyright (c) 2021 Rajarshee Chatterjee

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Individual ported files carry a header with the same attribution.

## Architecture references (no code copied)

The transport design (Cloudflare single-flight solver, typed source errors, extension
trust model) follows patterns studied in Mihon and Kotatsu. Their source code is
Apache-2.0 (Mihon) and GPL-3.0 (Kotatsu); no Kotatsu code is used. Mihon patterns are
reimplemented, not copied.

## Site content

Master Reader does not bundle, mirror or redistribute any site content, credentials or
trademarks. All novel text is fetched at runtime by the user from third-party sites.
Master Reader is unofficial and not affiliated with any source site.
