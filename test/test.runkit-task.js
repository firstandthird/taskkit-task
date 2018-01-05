'use strict';
const test = require('tap').test;
const TaskKitTask = require('../index.js');
const fs = require('fs');
const util = require('util');
const readFile = util.promisify(fs.readFile);

test('can be constructed', (t) => {
  const kit = {};
  const options = {
    x: 1
  };
  const task = new TaskKitTask('test', options, kit);
  t.equal(task instanceof TaskKitTask, true);
  t.equal(task.name, 'test');
  t.equal(task.options.x, 1);
  t.end();
});

test('calls init when constructed', (t) => {
  class Test extends TaskKitTask {
    init() {
      t.end();
    }
  }
  new Test('test', {}, {});
});

test('can get default options', (t) => {
  const defaultTask = new TaskKitTask('test', {}, {});
  t.equal(defaultTask.defaultOptions.x, undefined);
  class Test extends TaskKitTask {
    get defaultOptions() {
      return { x: 1 };
    }
  }
  const task = new Test('test', {}, {});
  t.equal(task.defaultOptions.x, 1);
  t.end();
});

test('merge nested options', (t) => {
  class Task extends TaskKitTask {
    get defaultOptions() {
      return {
        a: {
          b: 123,
          c: 456
        },
        debug: false
      };
    }
  }
  const options = {
    a: {
      b: 456
    }
  };
  const task = new Task('task', options, {});
  t.deepEqual(task.options, {
    a: {
      b: 456,
      c: 456
    },
    debug: false
  });
  t.end();
});

test('can get description ', (t) => {
  const defaultTask = new TaskKitTask('test', {}, {});
  t.equal(defaultTask.description, '');
  class Test extends TaskKitTask {
    get description() {
      return 'a test task';
    }
  }
  const task = new Test('test', {}, {});
  t.equal(task.description, 'a test task');
  t.end();
});

test('updates options ', (t) => {
  const task = new TaskKitTask('test', {}, {});
  task.updateOptions({ x: 1 });
  t.equal(task.options.x, 1);
  t.end();
});

test('execute -- will not fire if no items / files passed', async(t) => {
  t.plan(1);
  const task = new TaskKitTask('test', {
    items: []
  }, {});
  task.process = () => {
    t.fail();
  };
  await task.execute();
  t.pass();
});

test('execute -- can be disabled', async(t) => {
  class DisabledTask extends TaskKitTask {
    process() {
      t.fail();
    }
  }
  const task = new DisabledTask('test', {
    items: [],
    enabled: false
  }, {});
  await task.execute();
  t.end();
});

test('execute -- will fire process on items in list', async(t) => {
  t.plan(3);
  const task = new TaskKitTask('test', {
    items: {
      output1: 'input1'
    }
  }, {});
  task.process = (input, output) => {
    t.equal(input, 'input1');
    t.equal(output, 'output1');
    return 123;
  };
  const val = await task.execute();
  t.equal(val, 123);
});

test('fires onFinish event ', async(t) => {
  t.plan(3);
  class Test extends TaskKitTask {
    onFinish(results) {
      t.equal(results.length, 1);
      t.equal(results[0], undefined);
      return 123;
    }
  }
  const task = new Test('test', {
    items: {
      output1: 'input1'
    }
  }, {});
  const val = await task.execute();
  t.equal(val, 123);
});

test('writes files to dist directory ', async(t) => {
  t.plan(2);
  const task = new TaskKitTask('test', {
    dist: 'test/dist',
    items: {
      output1: 'input1'
    }
  }, {});
  await task.write('output.txt', 'contents');
  t.equal(fs.existsSync('test/dist/output.txt'), true);
  const data = await readFile('test/dist/output.txt');
  t.equal(data.toString(), 'contents');
});

test('writes when contents is stream', async(t) => {
  const task = new TaskKitTask('test', {
    dist: 'test/dist',
    items: {
    }
  }, {});
  await task.write('stream.txt', fs.createReadStream(`${__dirname}/fixtures/stream.txt`));
  t.equal(fs.existsSync('test/dist/stream.txt'), true);
  const data = await readFile('test/dist/stream.txt');
  t.equal(data.toString(), 'contents\n');
  t.end();
});

test('handles input as object', async(t) => {
  const task = new TaskKitTask('test', {
    files: {
      outputAsObject: {
        input: 'inputFromObject1',
        glop: true
      },
      outputAsObject2: {
        input: 'inputFromObject1',
        glyf: 'moe'
      }
    }
  }, {});
  // use 'delay' so the first process ends after the second:
  let delay = 2000;
  task.process = async(input, output, options) => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await wait(delay);
    delay = 10;
    return Object.keys(options);
  };
  const val = await task.execute();
  t.equal(val.length, 2, 'handles files specified as objects');
  t.equal(val[0].length, 2, 'options are correct during process');
  t.equal(val[1].length, 2, 'options are correct during process');
  t.equal(val[0][1], 'glop', 'options are correct during process');
  t.equal(val[1][1], 'glyf', 'options are correct during process');
  t.end();
});

test('writeMany files to dist directory ', async(t) => {
  t.plan(2);
  const task = new TaskKitTask('test', {
    dist: 'test/dist',
    items: {
      output1: 'input1'
    }
  }, {});
  await task.writeMany({
    'output1.txt': 'contents1',
    'output2.txt': 'contents2'
  });
  const data = await readFile('test/dist/output1.txt');
  t.equal(data.toString(), 'contents1');
  const data2 = await readFile('test/dist/output2.txt');
  t.equal(data2.toString(), 'contents2');
});

test('can override logger');

test('can write stream');
