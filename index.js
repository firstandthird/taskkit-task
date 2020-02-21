'use strict';
const path = require('path');
const fs = require('fs');
const aug = require('aug');
const bytesize = require('bytesize');
const mkdirp = require('mkdir-promise');
const util = require('util');
const writeFileAsync = util.promisify(fs.writeFile);

class TaskKitTask {
  constructor(name, options, kit = {}) {
    this.name = name;
    this.options = aug(this.defaultOptions, options);
    this.log = kit.logger || function(tags, msg) {
      if (typeof tags === 'string') {
        console.log(tags); //eslint-disable-line no-console
      } else {
        console.log(`[${tags.join(',')}] ${msg}`); //eslint-disable-line no-console
      }
    };
    this.runTask = kit.runTask || function(task) { this.log(['warning'], `not able to run ${task}`); };
    this.fullConfig = kit.config || {};
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

  get usesAsync() {
    return true;
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

  async write(filename, contents) {
    if (!contents) {
      this.log(['warning'], `attempting to write empty string to ${filename}`);
    }
    // if contents is a stream then get it as a string:
    contents = typeof contents === 'string' ? contents : await new Promise((resolve, reject) => {
      const chunks = [];
      contents.on('error', (err) => {
        this.log(['error'], err);
        this.emit('end');
      });
      contents.on('data', (data) => { chunks.push(data); });
      contents.on('close', () => resolve(Buffer.concat(chunks).toString()));
    });
    const output = path.join(this.options.dist || '', filename);
    const outputDir = path.dirname(output);

    if (!outputDir) {
      return;
    }
    await mkdirp(outputDir);
    await writeFileAsync(output, contents);
    let numericSize;
    let readableSize;
    if (this.options.gzipSize) {
      numericSize = await bytesize.gzipStringSize(contents, false);
      readableSize = await bytesize.gzipStringSize(contents, true);
    } else {
      numericSize = bytesize.stringSize(contents, false);
      readableSize = bytesize.stringSize(contents, true);
    }
    if (typeof this.options.sizeThreshold === 'number' && numericSize > this.options.sizeThreshold) {
      this.log(['warning'], `File ${filename} ${this.options.gzipSize ? 'gzipped' : ''} size is ${readableSize} (${numericSize} bytes), exceeds threshold of ${this.options.sizeThreshold} bytes`);
    }
    this.log(`Writing file ${filename} (${readableSize})`);
  }
}

module.exports = TaskKitTask;
