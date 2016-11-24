'use strict';
const async = require('async');
const Logr = require('logr');
const path = require('path');
const fs = require('fs');
const defaults = require('lodash.defaults');
const bytesize = require('bytesize');


class ClientKitTask {
  constructor(name, options, runner) {
    this.name = name;
    this.options = defaults(options, this.defaultOptions);
    this.log = this.options.log ? this.options.log : new Logr({
      type: 'cli',
      renderOptions: {
        cli: {
          prefix: `${name} | `,
          prefixColor: this.options.logColor || 'cyan'
        }
      }
    });
    this.runner = runner;
  }
  // your custom tasks can define their own default options:
  get defaultOptions() {
    return {};
  }
  // your custom tasks can define their own description:
  get description() {
    return '';
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
      this.log(['clientkit', 'warning'], `attempting to write empty string to ${filename}`);
    }
    const output = path.join(this.options.dist || '', filename);
    //TODO: better check of stream
    if (typeof contents === 'string') {
      const size = bytesize.stringSize(contents, true);
      this.log(['info'], `Writing file ${filename} (${size})`);
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
          this.log(['info'], `Writing file ${filename} (${size})`);
          done();
        });
      });
      contents.pipe(fileStream);
    }
  }
}

module.exports = ClientKitTask;
