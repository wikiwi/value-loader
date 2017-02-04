# Value Loader for Webpack

Like [val-loader](https://github.com/webpack-contrib/val-loader) but runs
file in a child compiler. Works with babel and TypeScript.

## Usage

``` javascript
let a = require("value-loader!./file.js");
// => excute file.js while compiling and
//    take the result as javascript code for including
```

This loader is also useful if you want to provide data for another loader:

``` javascript
require("css-loader!value-loader!./generateCss.js");
```

## Config

Instead of getting the whole `exports` object you can set `name` to the
named export you want to retrieve.

``` javascript
require("css-loader!value-loader?name=default!./generateCss.js");
```

## Acknowledgement

This work is heavily based on the work done by Nathan Tran for
[css-in-js-loader](https://github.com/nthtran/css-in-js-loader).

## License

MIT
