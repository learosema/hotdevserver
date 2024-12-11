# hotdevserver

`hotdevserver` is a single-file zero-dependency development web server with hot-reload, written in node.js, only using node-native dependencies.
No `npm install` needed.

It was originally made for the [sissi](https://sissi.js.org) static site generator, but separated in a separate module.

Usage: 
Copy the hotdevserver.js file into your project, make sure it has execution rights (chmod a+rx or chmod 755) and run it from the command line:

```sh
# By default, it looks for a `public` folder. 
./hotdevserver.js

# Optionally, you can specify a folder.
./hotdevserver.js dist

# By default, it uses port 8080. If you need another port, specify it:
PORT=12345 ./hotdevserver.js
```

## Known issues

This uses server-sent events which can cause problems with too many tabs open. Will upgrade it to websockets soon (node 22 has zero-dependency websockets).

Right now, it requires a body-tag to be present, as it looks for `</body>` and injects the autoreload-script before it.

## License

This is released into the public domain (aka "the Unlicense" aka CC0). Feel free to do what you want with it.
