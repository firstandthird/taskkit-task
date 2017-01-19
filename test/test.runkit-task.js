const test = require('tape');
const RunKitTask = require('../index.js');
const fs = require('fs');
test('can be constructed', (t) => {
  const kit = {};
  const options = {
    x: 1
  };
  const task = new RunKitTask('test', options, kit);
  t.equal(task instanceof RunKitTask, true);
  t.equal(task.name, 'test');
  t.equal(task.kit, kit);
  t.equal(task.options.x, 1);
  t.end();
});

test('calls init when constructed', (t) => {
  class Test extends RunKitTask {
    init() {
      t.end();
    }
  }
  const task = new Test('test', {}, {});
});

test('can get default options', (t) => {
  const defaultTask = new RunKitTask('test', {}, {});
  t.equal(defaultTask.defaultOptions.x, undefined);
  class Test extends RunKitTask {
    get defaultOptions() {
      return { x: 1 };
    }
  }
  const task = new Test('test', {}, {});
  t.equal(task.defaultOptions.x, 1);
  t.end();
});

test('can get description ', (t) => {
  const defaultTask = new RunKitTask('test', {}, {});
  t.equal(defaultTask.description, '');
  class Test extends RunKitTask {
    get description() {
      return 'a test task';
    }
  }
  const task = new Test('test', {}, {});
  t.equal(task.description, 'a test task');
  t.end();
});

test('logs messages with logger provided by kit', (t) => {
  const kit = {
    logger: (passedTags, passedMessages) => {
      t.equal(passedTags.length, 1);
      t.equal(passedTags[0], 'test');
      t.equal(passedMessages, 'hello');
      t.end();
    }
  };
  const task = new RunKitTask('test', {}, kit);
  task.log([], 'hello');
});

test('logs messages with default console.log if logger not provided by kit', (t) => {
  const oldLog = console.log;
  console.log = (passedTags, passedMessages) => {
    console.log = oldLog;
    t.equal(passedTags.length, 1);
    t.equal(passedTags[0], 'test');
    t.equal(passedMessages, 'hello');
    t.end();
  };
  const task = new RunKitTask('test', {}, {});
  task.log([], 'hello');
});

test('updates options ', (t) => {
  const task = new RunKitTask('test', {}, {});
  task.updateOptions({ x: 1 });
  t.equal(task.options.x, 1);
  t.end();
});

test('execute -- will not fire if no items / files passed', (t) => {
  t.plan(1);
  const task = new RunKitTask('test', {
    items: []
  }, {});
  task.process = () => {
    t.fail();
  };
  task.execute(() => {
    t.pass();
  });
});

test('execute -- can be disabled', (t) => {
  t.plan(1);
  const kit = {
    logger: (passedTags, passedMessages) => {
      t.equal(passedMessages, 'test skipped because it is disabled');
    }
  };
  const task = new RunKitTask('test', {
    items: [],
    enabled: false
  }, kit);
  task.execute(() => {
  });
});

test('execute -- will fire process on items in list', (t) => {
  t.plan(3);
  const task = new RunKitTask('test', {
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

test('fires onFinish event ', (t) => {
  t.plan(3);
  class Test extends RunKitTask {
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

test('writes files to dist directory ', (t) => {
  t.plan(4);
  const task = new RunKitTask('test', {
    dist: 'test/dist',
    items: {
      output1: 'input1'
    }
  }, {});
  task.write('output.txt', 'contents', (err, outcome) => {
    t.equal(err, null);
    fs.exists('test/dist/output.txt', (exists) => {
      t.equal(exists, true);
      fs.readFile('test/dist/output.txt', (err, data) => {
        t.equal(err, null);
        t.equal(data.toString(), 'contents');
      });
    });
  });
});
