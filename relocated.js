var glob = require('glob'),
    redis = require('redis'),
    resque = require('resque'),
    async = require('async'),
    _ = require('underscore'),
    cproc = require('child_process'),
    fs = require('fs');

var c
if(process.env['CONFIG']) {
    c = require(process.env['CONFIG'])
}
else {
    c = require('./config.js')
}

var Watcher = function(elm) {
    var self = this
    self.dir = elm.value
    self.interval = 1
    self.checker = function() { return null }
    self.relocate = function() { return null }
    self.dest = null
    self.glob = {}

    self.execRelocate = function(elm) {
        console.log("EXEC RELOCATE")
        var code = self.relocate()
        cproc.exec(code + ' ' + elm.me + ' ' + self.dir.class + ' ' + self.dest, function(err,stdout,stderr) {
            console.log("relocated",err,stdout,stderr)
        })
    }

    self.execChecker = function(elm) {
        var code = self.checker()
        console.log("EXEC CHECKER", elm.me,code)
        cproc.exec(code + ' ' + elm.me + ' ' + self.dir.class, function(err,stdout,stderr) {
            console.log("CHECKER",err,stdout,stderr)
            if(err.code == 1) {
                // we need to process this
                return self.execRelocate(elm)
            } else {
                // already processed
                console.log("ALREADY PROCESSED")
            }
        })
    }
    self.processGlobFile = function(file) {
        var elm
        var st

        elm = self.glob[file]

        if(elm) {

            if(elm.done) return

            st = fs.statSync(file)
            if(elm.size == st.size) {
                // file is still the same, it must be "done"
                console.log("the file", file)
                elm.done = true

                return self.execChecker(elm)
            }
        }
        else {
            self.glob[file] = fs.statSync(file)
            self.glob[file].me = file
        }
//        console.log(self.glob[file], st)
    }
    self.initGlob = function() {
        async.eachSeries(self.dir.glob, function(dir) {
            glob(dir, {}, function(err,files) {
//                console.log(err,files)
                if(err) return
                _.each(files, function(value,key,list) {
                    if(!self.glob[key]) {
//                        console.log(value,key)
                        //glob[value] = {
                        //}
                        self.processGlobFile(value)
                    }
                })
            })
        }, function(err,data) {
            console.log("err",err,"data",data)
        })
    }
    self.initInterval = function() {
        setInterval(function() {
            console.log("hi")
            self.initGlob()
        }, self.interval*1000)
    }
    self.init = function() {
//        console.log(elm.value)
//        self.initGlob()
        if(self.dir.interval) {
            self.interval = self.dir.interval
        } else if(c.interval) {
            self.interval = c.interval
        }

        if(self.dir.check) {
            self.checker = function() { return self.dir.check }
        } else if(c.check) {
            self.checker = function() { return c.check }
        }
        else {
            console.log("error: you must specify a checker bin")
            process.exit(-1)
        }

        if(self.dir.relocate) {
            self.relocate = function() { return self.dir.relocate }
        } else if(c.relocate) {
            self.relocate = function() { return c.relocate }
        } else {
            console.log("error: you must specify a relocate bin")
            process.exit(-1)
        }

        if(self.dir.dest) {
            self.dest = self.dir.dest
        } else if(c.dest) {
            self.dest = c.dest
        } else {
            console.log("error: you must specify a destination path")
            process.exit(-1)
        }

        self.initInterval()
    }
    self.init()
}

_.each(c.directories, function(value,key,list) {
//    console.log(value,key,key[value],list)
    var watcher = new Watcher({ key: key, value: value })
})
