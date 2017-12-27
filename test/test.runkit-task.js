'use strict';
const tap = require('tap');
const TaskKitTask = require('../index.js');
const fs = require('fs');

tap.test('can be constructed', (t) => {
  const kit = {};
  const options = {
    x: 1
  };
  const task = new TaskKitTask('test', options, kit);
  t.equal(task instanceof TaskKitTask, true);
  t.equal(task.name, 'test');
  t.equal(task.kit, kit);
  t.equal(task.options.x, 1);
  t.end();
});

tap.test('calls init when constructed', (t) => {
  class Test extends TaskKitTask {
    init() {
      t.end();
    }
  }
  const task = new Test('test', {}, {});
});

tap.test('can get default options', (t) => {
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

tap.test('merge nested options', (t) => {
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

tap.test('can get description ', (t) => {
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

tap.test('updates options ', (t) => {
  const task = new TaskKitTask('test', {}, {});
  task.updateOptions({ x: 1 });
  t.equal(task.options.x, 1);
  t.end();
});

tap.test('execute -- will not fire if no items / files passed', (t) => {
  t.plan(1);
  const task = new TaskKitTask('test', {
    items: []
  }, {});
  task.process = () => {
    t.fail();
  };
  task.execute(() => {
    t.pass();
  });
});

tap.test('execute -- can be disabled', (t) => {
  class DisabledTask extends TaskKitTask {
    process() {
      t.fail();
    }
  }
  const task = new DisabledTask('test', {
    items: [],
    enabled: false
  }, {});
  task.execute(() => {
    t.pass();
    t.end();
  });
});

tap.test('execute -- will fire process on items in list', (t) => {
  t.plan(3);
  const task = new TaskKitTask('test', {
    items: {
      output1: 'input1'
    }
  }, {});
  task.process = (input, output, done) => {
    t.equal(input, 'input1');
    t.equal(output, 'output1');
    done(123);
  };
  task.execute((val) => {
    t.equal(val, 123);
  });
});

tap.test('fires onFinish event ', (t) => {
  t.plan(3);
  class Test extends TaskKitTask {
    onFinish(results, done) {
      t.equal(results.length, 1);
      t.equal(results[0], undefined);
      done(123);
    }
  }
  const task = new Test('test', {
    items: {
      output1: 'input1'
    }
  }, {});
  task.execute((val) => {
    t.equal(val, 123);
  });
});

tap.test('writes files to dist directory ', (t) => {
  t.plan(4);
  const task = new TaskKitTask('test', {
    dist: 'test/dist',
    items: {
      output1: 'input1'
    }
  }, {});
  task.write('output.txt', 'contents', (err, outcome) => {
    t.equal(err, null);
    fs.exists('test/dist/output.txt', (exists) => {
      t.equal(exists, true);
      fs.readFile('test/dist/output.txt', (err2, data) => {
        t.equal(err2, null);
        t.equal(data.toString(), 'contents');
      });
    });
  });
});

tap.test('handles input as object', (t) => {
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
  task.process = (input, output, options, done) => {
    setTimeout(() => {
      done(null, Object.keys(options));
    }, delay);
    delay = 10;
  };
  task.execute((err, val) => {
    t.equal(err, null);
    t.equal(val.length, 2, 'handles files specified as objects');
    t.equal(val[0].length, 2, 'options are correct during process');
    t.equal(val[1].length, 2, 'options are correct during process');
    t.equal(val[0][1], 'glop', 'options are correct during process');
    t.equal(val[1][1], 'glyf', 'options are correct during process');
    t.end();
  });
});

tap.test('writeMany files to dist directory ', (t) => {
  t.plan(7);
  const task = new TaskKitTask('test', {
    dist: 'test/dist',
    items: {
      output1: 'input1'
    }
  }, {});
  task.writeMany({
    'output1.txt': 'contents1',
    'output2.txt': 'contents2'
  }, (err, outcome) => {
    t.equal(err, null);
    fs.exists('test/dist/output1.txt', (exists) => {
      t.equal(exists, true);
      fs.readFile('test/dist/output1.txt', (err2, data) => {
        t.equal(err2, null);
        t.equal(data.toString(), 'contents1');
        fs.exists('test/dist/output2.txt', (exists2) => {
          t.equal(exists2, true);
          fs.readFile('test/dist/output2.txt', (err3, data2) => {
            t.equal(err3, null);
            t.equal(data2.toString(), 'contents2');
          });
        });
      });
    });
  });
});

tap.test('parallel execute -- will fire process on items in list in separate process', (t) => {
  const task = new TaskKitTask('test', {
    multithread: true,
    items: {
      output1: 'input1'
    }
  }, {});
  task.process = (input, output, done) => {
    // this takes place in a child_process
    done(null, 123);
  };
  task.execute((err, res) => {
    t.equal(err, null);
    t.end();
  });
});
