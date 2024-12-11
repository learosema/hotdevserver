# hotdevserver

`hotdevserver` is a single-file zero-dependency development web server with hot-reload, written in node.js, only using node-native dependencies.
No `npm install` needed.

It was originally made for the [sissi](https://sissi.js.org) static site generator, but separated in a separate module

Usage:

```sh
node hotdevserver.js
```

## Known issues

This uses server-sent events which can cause problems with too many tabs open. Will upgrade it to websockets soon (node 22 has zero-dependency websockets).

## License

This is released into the public domain (aka "the Unlicense" aka CC0). Feel free to do what you want with it.
