'use strict';
const path = require('path');
const fs = require('fs');
const aug = require('aug');
const bytesize = require('bytesize');
const mkdirp = require('mkdirp-promise');
const spawn = require('threads').spawn;
const Logr = require('logr');
const util = require('util');

// a wrapper for running tasks in their own process:
const runInParallel = async(data, done) => {
  const ProcessClassDef = require(data.classModule);
  const taskInstance = new ProcessClassDef(data.name, data);
  taskInstance.options.multithread = false;
  taskInstance.name = data.name;
  await taskInstance.execute();
  done();
};

class TaskKitTask {
  constructor(name, options, kit) {
    this.name = name;
    this.options = aug('deep', {}, this.defaultOptions, options);
    this.kit = kit || {};
    this.log = Logr.createLogger({
      defaultTags: [name],
      reporters: {
        cliFancy: {
          reporter: require('logr-cli-fancy')
        },
        bell: {
          reporter: require('logr-reporter-bell')
        }
      }
    });
    this.init();
  }
  // returns the module to load when running in a separate process:
  get classModule() {
    return path.join(__dirname, 'index.js');
  }
  // your custom tasks can define their own default options:
  get defaultOptions() {
    return {};
  }
  // your custom tasks can define their own description:
  get description() {
    return '';
  }

  init() {
  }

  updateOptions(newOptions) {
    this.options = newOptions;
  }

  async execute() {
    if (this.options.multithread) {
      return new Promise((resolve, reject) => {
        const options = Object.assign({}, this.options);
        options.classModule = this.classModule;
        options.multithread = false;
        options.name = this.name;
        const thread = spawn(runInParallel);
        thread.send(options)
        .on('message', (response) => {
          thread.kill();
          resolve(response)
        })
        .on('error', (error) => {
          reject(error);
        })
        .on('exit', () => {});
      });
    }
    const items = this.options.files || this.options.items;
    if (!items) {
      return this.log(['warning'], 'No input files, skipping');
    }
    if (this.options.enabled === false) {
      return this.log(`${this.name} skipped because it is disabled`);
    }
    const filenames = Object.keys(items);
    const originalOptions = this.options;
    // must be done sequentially so that this.options does not get changed
    // in between calls to .process:
    let results = filenames.map(async(outputFile) => {
      const item = items[outputFile];
      let inputName = item;
      if (typeof item === 'object' && item.input) {
        inputName = item.input;
      }
      // make sure we have fresh options:
      const options = Object.assign({}, originalOptions);
      // if item is an object, copy over all keys as options except 'input':
      if (typeof item === 'object') {
        Object.keys(item).forEach((key) => {
          if (key !== 'input') {
            options[key] = item[key];
          }
        });
      }
      const start = new Date().getTime();
      const result = this.process(inputName, outputFile, options);
      const end = new Date().getTime();
      const duration = (end - start) / 1000;
      this.log(`Processed ${outputFile} in ${duration} sec`);
      return result;
    });
    return this.onFinish(await Promise.all(results));
  }

  onFinish(results) {
    // just return the first item if only one:
    if (results.length === 1) {
      results = results[0];
    }
    return results;
  }

  process(input, output, options) {
    if (!options) {
      options = {};
    }
    return;
  }

  async writeMany(fileContents) {
    return Promise.all(Object.keys(fileContents).map(fileName => this.write(fileName, fileContents[fileName])));
  }

  async write(filename, contents) {
    if (!contents) {
      this.log(['warning'], `attempting to write empty string to ${filename}`);
    }
    const self = this;
    const output = path.join(this.options.dist || '', filename);
    const outputDir = path.dirname(output);

    if (!outputDir) {
      return;
    }
    await mkdirp(outputDir);
    //TODO: better check of stream
    if (typeof contents === 'string') {
      await util.promisify(fs.writeFile)(output, contents);
    } else {
      const fileStream = fs.createWriteStream(output);
      contents.on('error', function (err) {
        self.log(['error'], err);
        this.emit('end');
      });
      fileStream.on('finish', done);
      contents.pipe(fileStream);
    }
    if (typeof contents === 'string') {
      const size = bytesize.stringSize(contents, true);
      return size;
    }
    const size = await util.promisify(bytesize.fileSize)(output, true);
    self.log(`Writing file ${filename} (${size})`);
    return size;
  }
}

module.exports = TaskKitTask;
