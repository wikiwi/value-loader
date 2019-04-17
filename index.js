const path = require("path");
const fs = require("fs");
const NodeTemplatePlugin = require("webpack/lib/node/NodeTemplatePlugin");
const NodeTargetPlugin = require("webpack/lib/node/NodeTargetPlugin");
const LibraryTemplatePlugin = require("webpack/lib/LibraryTemplatePlugin");
const SingleEntryPlugin = require("webpack/lib/SingleEntryPlugin");
const LimitChunkCountPlugin = require("webpack/lib/optimize/LimitChunkCountPlugin");
const loaderUtils = require("loader-utils");

module.exports = function (source) {
  if (this.cacheable) this.cacheable();
  return source;
};

module.exports.pitch = function (request, prevRequest) {
  if (this.cacheable) this.cacheable();
  const callback = this.async();
  if ([".js", ".ts"].indexOf(path.extname(request)) >= 0) {
    produce(this, request, callback, loaderUtils.getOptions(this));
  } else {
    const parts = request.split("!");
    const filename = parts[parts.length - 1];
    this.addDependency(filename);
    fs.readFile(filename, "utf8", callback);
  }
};

function produce(loader, request, callback, config) {
  const childFilename = "value-output-filename";
  const outputOptions = { filename: childFilename };
  const childCompiler = getRootCompilation(loader)
      .createChildCompiler("value-compiler", outputOptions);
  new NodeTemplatePlugin(outputOptions).apply(childCompiler);
  new LibraryTemplatePlugin(null, "commonjs2").apply(childCompiler);
  new NodeTargetPlugin().apply(childCompiler);
  new SingleEntryPlugin(loader.context, `!!${request}`).apply(childCompiler);
  new LimitChunkCountPlugin({ maxChunks: 1 }).apply(childCompiler);
  const subCache = `subcache ${__dirname} ${request}`;

  const plugin = { name: 'ValueLoader' };
  childCompiler.hooks.compilation.tap(plugin, (compilation) => {
    if (compilation.cache) {
      if (!compilation.cache[subCache])
              { compilation.cache[subCache] = {}; }
      compilation.cache = compilation.cache[subCache];
    }
  });
  // We set loaderContext[__dirname] = false to indicate we already in
  // a child compiler so we don't spawn another child compilers from there.
  childCompiler.hooks.thisCompilation.tap(plugin, (compilation) => {
    compilation.hooks.normalModuleLoader.tap(plugin, (loaderContext) => {
      loaderContext[__dirname] = false;
    });
  });
  let source;
  childCompiler.hooks.afterCompile.tap(plugin, (compilation) => {
    source = compilation.assets[childFilename] && compilation.assets[childFilename].source();

    // Remove all chunk assets
    compilation.chunks.forEach((chunk) => {
      chunk.files.forEach((file) => {
        delete compilation.assets[file];
      });
    });
  });

  childCompiler.runAsChild((err, entries, compilation) => {
    if (err) return callback(err);

    if (compilation.errors.length > 0) {
      return callback(compilation.errors[0]);
    }
    if (!source) {
      return callback(new Error("Didn't get a result from child compiler"));
    }
    compilation.fileDependencies.forEach((dep) => {
      loader.addDependency(dep);
    }, loader);
    compilation.contextDependencies.forEach((dep) => {
      loader.addContextDependency(dep);
    }, loader);

    let exports;
    try {
      exports = loader.exec(source, request);
    } catch (e) {
      return callback(e);
    }
    if (exports) {
      const name = config.name;
      if (name && name in exports) {
        exports = exports[name];
      }
      callback(null, exports);
    } else {
      callback();
    }
  });
}

function getRootCompilation(loader) {
  let compiler = loader._compiler;
  let compilation = loader._compilation;
  while (compiler.parentCompilation) {
    compilation = compiler.parentCompilation;
    compiler = compilation.compiler;
  }
  return compilation;
}
