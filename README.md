# clientkit-task


  The base class for creating new ClientKit plugin tasks.  

  [__Clientkit__](https://github.com/firstandthird/clientkit) is an extensible platform for building-out the client portions of your websites. clientkit-task is the base class for making plugins for clientkit.

  ## Example:

  Let's say that you want your Javascript source files that start with the keyword 'class_' to be copied to your output directory, but without the 'class' portion at the beginning of the filename. So every time you run clientkit, a source file named 'class_Factory.js' in your project directory will be copied over as 'Factory.js' to your distribution directory.

  How to build this task and add it to clientkit?  The first thing you would do is create a new task, by extending the clientkit-task class.  Create a file containing the following code, we'll name the file _classwriter.js_:

  #### Code
  ```js
  const ClientKitTask = require('clientkit-task');
  class ClassWriter extends ClientKitTask {
    process(inputFileName, outputFileName, done) {
      this.log('Classwriter is writing %s', inputFileName)
      const newName = outputFileName.replace('class_', '');
      const contents = fs.readFileSync(inputFileName, 'utf-8');
      return this.write(newName, contents, done);
    }
  }
  ```

    As you can see, almost all of the work is done by extending the _process_ method in clientkit-task.  We can add the task 'classwriter' to a task set in our clientkit config, here we add it to the 'default' task set:
  ```yaml
  tasks:
  default:
    - 'initialize'
    - 'classwriter'
  ```

  And specify config options for classwriter:
  ```yaml
tasks:
  classwriter: '{{CKDIR}}/tasks/classwriter.js'
classwriter:
  logColor: 'yellow'
  dist: '{{dist}}'
  files:
     js: 'myProjectDir/**/class_*.js'
  ```

Now run clientkit against these config files. Assuming myProjectDir has a js file

  ## Methods in clientkit-task
