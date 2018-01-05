'use strict';
const path = require('path');
const fs = require('fs');
const aug = require('aug');
const bytesize = require('bytesize');
const mkdirp = require('mkdirp-promise');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);
const fileSize = util.promisify(bytesize.fileSize);

class TaskKitTask {
  constructor(name, options, kit = {}) {
    this.name = name;
    this.options = aug(this.defaultOptions, options);
    if (!kit.logger) {
      this.log = (tags, msg) => {
        if (typeof tags === 'string') {
          console.log(tags); //eslint-disable-line no-console
        } else {
          console.log(`[${tags.join(',')}] ${msg}`); //eslint-disable-line no-console
        }
      };
    } else {
      this.log = kit.logger;
    }
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

  updateOptions(newOptions) {
    this.options = newOptions;
  }

  async execute() {
    const items = this.options.files || this.options.items;
    if (!items) {
      return this.log(['warning'], 'No input files, skipping');
    }
    if (this.options.enabled === false) {
      return this.log(`${this.name} skipped because it is disabled`);
    }
    const filenames = Object.keys(items);
    const originalOptions = this.options;
    const processOne = async (outputFile) => {
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
      const result = await this.process(inputName, outputFile, options);
      const end = new Date().getTime();
      const duration = (end - start) / 1000;
      this.log(`Processed ${outputFile} in ${duration} sec`);
      return result;
    };
    const promises = filenames.map(f => processOne(f));
    const results = await Promise.all(promises);
    return this.onFinish(results);
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

  writeMany(fileContents) {
    const promises = Object.keys(fileContents).map(fileName => this.write(fileName, fileContents[fileName]));
    return Promise.all(promises);
  }

  writeFile(filepath, contents) {
    if (typeof contents === 'string') {
      return writeFile(filepath, contents);
    }
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(filepath);
      contents.on('error', (err) => {
        this.log(['error'], err);
        this.emit('end');
      });
      contents.on('close', () => {
        resolve();
      });
      contents.pipe(fileStream);
    });
  }

  async write(filename, contents) {
    if (!contents) {
      this.log(['warning'], `attempting to write empty string to ${filename}`);
    }
    const output = path.join(this.options.dist || '', filename);
    const outputDir = path.dirname(output);

    if (!outputDir) {
      return;
    }
    await mkdirp(outputDir);
    await this.writeFile(output, contents);
    let size;
    if (typeof contents === 'string') {
      size = bytesize.stringSize(contents, true);
    } else {
      //size = await fileSize(output, true);
      size = '--';
    }
    this.log(`Writing file ${filename} (${size})`);
  }
}

module.exports = TaskKitTask;
