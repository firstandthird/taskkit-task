'use strict';
const async = require('async');
const path = require('path');
const fs = require('fs');
const aug = require('aug');
const bytesize = require('bytesize');
const mkdirp = require('mkdirp');
const spawn = require('threads').spawn;
const Logr = require('logr');

// a wrapper for running tasks in their own process:
const runInParallel = (data, allDone) => {
  const ProcessClassDef = require(data.classModule);
  const taskInstance = new ProcessClassDef(data.name, data);
  taskInstance.options.multithread = false;
  taskInstance.name = data.name;
  taskInstance.execute(allDone);
};

class TaskKitTask {
  constructor(name, options, kit) {
    this.name = name;
    this.options = aug('deep', {}, this.defaultOptions, options);
    this.kit = kit || {};
    this.log = Logr.createLogger({
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

  log(tags, message) {
    if (!message) {
      message = tags;
      tags = [];
    }
    tags = [this.name].concat(tags);
    this.log(tags, message);
  }

  updateOptions(newOptions) {
    this.options = newOptions;
  }

  execute(allDone) {
    if (this.options.multithread) {
      const options = Object.assign({}, this.options);
      options.classModule = this.classModule;
      options.multithread = false;
      options.name = this.name;
      const thread = spawn(runInParallel);
      thread.send(options)
        .on('message', (response) => {
          thread.kill();
          return allDone(null, response);
        })
        .on('error', (error) => {
          allDone(error);
        })
        .on('exit', () => {});
      return;
    }
    const items = this.options.files || this.options.items;
    if (!items) {
      this.log(['warning'], 'No input files, skipping');
      return allDone();
    }
    if (this.options.enabled === false) {
      this.log(`${this.name} skipped because it is disabled`);
      return allDone();
    }
    const filenames = Object.keys(items);
    const originalOptions = this.options;
    // must be done sequentially so that this.options does not get changed
    // in between calls to .process:
    async.map(filenames, (outputFile, eachDone) => {
      const item = items[outputFile];
      const inputName = typeof item === 'object' ? item.input : item;
      const start = new Date().getTime();
      const processDone = (err, results) => {
        if (err) {
          return eachDone(err);
        }
        const end = new Date().getTime();
        const duration = (end - start) / 1000;
        this.log(`Processed ${outputFile} in ${duration} sec`);
        eachDone(null, results);
      };
      // if process was designed to take in a local options param:
      if (this.process.length === 3) {
        return this.process(inputName, outputFile, processDone);
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
      this.process(inputName, outputFile, options, processDone);
    }, (err, results) => {
      if (err) {
        return allDone(err);
      }
      this.onFinish(results, allDone);
    });
  }

  onFinish(results, done) {
    done(null, results);
  }

  process(input, output, options, done) {
    if (typeof options === 'function') {
      done = options;
    }
    done();
  }

  writeMany(fileContents, allDone) {
    async.mapValues(fileContents, (fileContent, fileName, done) => {
      this.write(fileName, fileContent, done);
    }, allDone);
  }

  write(filename, contents, allDone) {
    if (!contents) {
      this.log(['warning'], `attempting to write empty string to ${filename}`);
    }
    const self = this;
    const output = path.join(this.options.dist || '', filename);
    const outputDir = path.dirname(output);

    async.autoInject({
      mkdir(done) {
        if (!outputDir) {
          return done();
        }
        mkdirp(outputDir, done);
      },
      write(mkdir, done) {
        //TODO: better check of stream
        if (typeof contents === 'string') {
          fs.writeFile(output, contents, done);
        } else {
          const fileStream = fs.createWriteStream(output);
          contents.on('error', function (err) {
            self.log(['error'], err);
            this.emit('end');
          });
          fileStream.on('finish', done);
          contents.pipe(fileStream);
        }
      },
      size(write, done) {
        if (typeof contents === 'string') {
          const size = bytesize.stringSize(contents, true);
          return done(null, size);
        }
        bytesize.fileSize(output, true, done);
      },
      log(size, done) {
        self.log(`Writing file ${filename} (${size})`);
        done();
      }
    }, allDone);
  }
}

module.exports = TaskKitTask;
