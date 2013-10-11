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
    self.glob = {}
    self.execChecker = function(elm) {
        var code = self.checker()
        console.log("EXEC CHECKER", elm.me,code)
        cproc.exec(code + ' ' + elm.me + ' ' + self.dir.class, function(err,stdout,stderr) {
            console.log(err,stdout,stderr)
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
            console.log("error: you must specify a checker")
            process.exit()
        }

        self.initInterval()
    }
    self.init()
}

_.each(c.directories, function(value,key,list) {
//    console.log(value,key,key[value],list)
    var watcher = new Watcher({ key: key, value: value })
})
