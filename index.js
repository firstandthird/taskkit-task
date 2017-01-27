'use strict';
const async = require('async');
const path = require('path');
const fs = require('fs');
const aug = require('aug');
const bytesize = require('bytesize');
const mkdirp = require('mkdirp');


class TaskKitTask {
  constructor(name, options, kit) {
    this.name = name;
    this.options = aug('deep', {}, this.defaultOptions, options);
    this.kit = kit || {};
    this.init();
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
    if (!this.kit.logger) {
      console.log(tags, message); //eslint-disable-line no-console
    } else {
      this.kit.logger(tags, message);
    }
  }

  updateOptions(newOptions) {
    this.options = newOptions;
  }

  execute(allDone) {
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
      this.onFinish(results, allDone);
    });
  }

  onFinish(results, done) {
    done(null, results);
  }

  process(input, output, done) {
    done();
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
