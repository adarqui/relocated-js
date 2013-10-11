var glob = require('glob'),
    redis = require('redis'),
    resque = require('resque'),
    async = require('async'),
    _ = require('underscore'),
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
    self.checker = function() { }
    self.relocate = function() { }
    self.glob = {}
    self.initGlob = function() {
        async.eachSeries(self.dir.glob, function(dir) {
            glob(dir, {}, function(err,files) {
                console.log(err,files)

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
        console.log(elm.value)
//        self.initGlob()
        if(self.dir.interval) {
            self.interval = self.dir.interval
        } else if(c.interval) {
            self.interval = c.interval
        }
        self.initInterval()
    }
    self.init()
}

_.each(c.directories, function(value,key,list) {
//    console.log(value,key,key[value],list)
    var watcher = new Watcher({ key: key, value: value })
})
