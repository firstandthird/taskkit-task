'use strict';
const async = require('async');
const path = require('path');
const fs = require('fs');
const defaults = require('lodash.defaults');
const bytesize = require('bytesize');
const version = require('./package.json').version;


class ClientKitTask {
  constructor(name, options, runner, logger) {
    this.name = name;
    this.options = defaults(options, this.defaultOptions);
    this.runner = runner;
    this.logger = logger;
  }
  // your custom tasks can define their own default options:
  get defaultOptions() {
    return {};
  }
  // your custom tasks can define their own description:
  get description() {
    return '';
  }

  get clientkitVersion() {
    return version;
  }

  log(tags, message) {
    if (!message) {
      message = tags;
      tags = [];
    }
    tags = [this.name].concat(tags);
    if (!this.logger) {
      console.log(tags, message); //eslint-disable-line no-console
    } else {
      this.logger(tags, message);
    }
  }

  updateOptions(newOptions) {
    this.options = newOptions;
  }

  execute(allDone) {
    const items = this.options.files || this.options.items;
    if (!items) {
      return allDone();
    }
    if (this.options.enabled === false) {
      this.log(`${this.name} skipped because it is disabled`);
      return allDone();
    }
    const allStart = new Date().getTime();
    const filenames = Object.keys(items);
    async.map(filenames, (filename, next) => {
      const start = new Date().getTime();
      this.process(items[filename], filename, (err, results) => {
        if (err) {
          return next(err);
        }
        const end = new Date().getTime();
        const duration = (end - start) / 1000;
        this.log(`Processed ${filename} in ${duration} sec`);
        next(null, results);
      });
    }, (err, results) => {
      if (err) {
        return allDone(err);
      }
      const allEnd = new Date().getTime();
      const duration = (allEnd - allStart) / 1000;
      this.log(`Processed all ${this.name} in ${duration} sec`);
      this.onFinish(results, allDone);
    });
  }

  onFinish(results, done) {
    done(null, results);
  }

  process(input, output, done) {
    done();
  }

  write(filename, contents, done) {
    if (!contents) {
      this.log(['warning'], `attempting to write empty string to ${filename}`);
    }
    const output = path.join(this.options.dist || '', filename);
    //TODO: better check of stream
    if (typeof contents === 'string') {
      const size = bytesize.stringSize(contents, true);
      this.log(`Writing file ${filename} (${size})`);
      fs.writeFile(output, contents, done);
    } else {
      const fileStream = fs.createWriteStream(output);
      const self = this;
      contents.on('error', function (err) {
        self.log(['error'], err);
        this.emit('end');
      });
      fileStream.on('finish', () => {
        bytesize.fileSize(output, true, (err, size) => {
          if (err) {
            return done(err);
          }
          this.log(`Writing file ${filename} (${size})`);
          done();
        });
      });
      contents.pipe(fileStream);
    }
  }
}

module.exports = ClientKitTask;
