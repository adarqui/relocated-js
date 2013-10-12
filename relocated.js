/*
 * relocated - a file relocation daemon
 *
 *  Uses: processing files after they are done uploaded to a box by a third party
 *
 * -- adarqui
 *
 *  ps: it doesn't use watchFile()/inotify() on purpose.
 */
var glob = require('glob'),
    redis = require('redis'),
    resque = require('resque'),
    async = require('async'),
    _ = require('underscore'),
    resque = require('resque'),
    winston = require('winston'),
    cproc = require('child_process'),
    fs = require('fs');

var c;

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
    self.namespace = "relocated"

    self.redis = {
        host : "127.0.0.1",
        port : 6379,
        chan : {},
    }

    self.redisRelocateSuccess = function(elm,cb) {
        winston.info('Relocate: '+elm.me+' success -> relocated')
        self.redis.chan.sadd(self.namespace + ':' + 'processed', elm.me, function(err,dat) {
            if(err) {
                winston.error('Relocate: '+elm.me+' success -> redis failed')
            }
            return cb()
        })
    }

    self.redisCheckerFailed = function(elm,cb) {
        winston.error('Checker: '+elm.me+' failed')
        self.redis.chan.sadd(self.namespace + ':' + 'checker:failed', elm.me, function(err,dat) {
            if(err) {
                winston.error('Checker: '+elm.me+' failed -> redis')
            }
            return cb()
        })
    }

    self.redisRelocateFailed = function(elm,cb) {
        winston.error('Relocate: '+elm.me+' failed')
        self.redis.chan.sadd(self.namespace + ':' + 'relocate:failed', elm.me, function(err,dat) {
            if(err) {
                winston.error('Relocate: '+elm.me+' failed -> redis')
            }
            return cb()
        })
    }

    self.execRelocate = function(elm,cb) {
        var code = self.relocate()
        cproc.exec(code + ' ' + elm.me + ' ' + self.dir.class + ' ' + self.dest, function(err,stdout,stderr) {
            if(err && err.code == 1) {
                // relocate failure
                self.redisRelocateFailed(elm,cb)
            } else {
                // relocate success
                self.redisRelocateSuccess(elm,cb)
            }
        })
    }

    self.execChecker = function(elm,cb) {
        var code = self.checker()
        cproc.exec(code + ' ' + elm.me + ' ' + self.dir.class, function(err,stdout,stderr) {
            if(err && err.code == 1) {
                // we need to process this
                return self.execRelocate(elm,cb)
            } else {
                // already processed
                return self.redisCheckerFailed(elm,cb)
            }
        })
    }
    self.processGlobFile = function(file,cb) {
        var elm
        var st

        elm = self.glob[file]

        if(elm) {

            if(elm.done) return cb();

            st = fs.statSync(file)
            if(elm.size == st.size) {
                // file is still the same, it must be "done"
                elm.done = true
                return self.execChecker(elm,cb)
            }

            elm.size = st.size
        }
        else {
            self.glob[file] = fs.statSync(file)
            self.glob[file].me = file
        }
        return cb()
    }
    self.initGlob = function() {
        async.eachSeries(self.dir.glob, function(dir,cb) {
            glob(dir, {}, function(err,files) {
                if(err) return
                _.each(files, function(value,key,list) {
                    if(!self.glob[key]) {
                        self.processGlobFile(value,cb)
                    }
                    else return cb()
                })
            })
        }, function(err,data) {
            if(err) {
                winston.error('initGlob: '+elm.key+' error', { error : err })
            }
        })
    }
    self.initInterval = function() {
        setInterval(function() {
            self.initGlob()
        }, self.interval*1000)
    }
    self.init = function() {

        if(self.dir.namespace) {
            self.namespace = self.dir.namespace
        } else if(c.namespace) {
            self.namespace = c.namespace
        } else {
            winston.error('Init: '+elm.key+' namespace -> undefined')
            process.exit(-1)
        }

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
            winston.error('Init: '+elm.key+' checker -> unspecified')
            process.exit(-1)
        }

        if(self.dir.relocate) {
            self.relocate = function() { return self.dir.relocate }
        } else if(c.relocate) {
            self.relocate = function() { return c.relocate }
        } else {
            winston.error('Init: '+elm.key+' relocate -> unspecified')
            process.exit(-1)
        }

        if(self.dir.dest) {
            self.dest = self.dir.dest
        } else if(c.dest) {
            self.dest = c.dest
        } else {
            winston.error('Init: '+elm.key+' destination -> unspecified')
            process.exit(-1)
        }


        if(self.dir.redis) {
            self.redis.host = self.dir.redis.host
            self.redis.port = self.dir.redis.port
        } else if(c.redis) {
            self.redis.host = c.redis.host
            self.redis.port = c.redis.port
        } else {
            winston.error('Init: '+elm.key+' redis -> unspecified')
            process.exit()
        }

        try {
            self.redis.chan = redis.createClient(self.redis.port,self.redis.host)
            winston.info('Init: '+elm.key+' redis -> successfully connected')
        } catch(err) {
            winston.error('Init: '+elm.key+' redis -> unable to connect')
            return
        }

        self.redis.chan.on('error', function(err) {
            winston.error('Redis: '+elm.key+' disconnected')
            return
        })

        self.initInterval()
    }
    self.fini = function() {
        try {
            self.redis.chan.end()
        } catch(err) {
            winston.error('Fini: '+elm.key+' error -> closing redis socket', err)
        }
    }
    self.init()
}


var misc = {
    returnFullPath : function(s) {
        if(!s) return s
        if(s[0] != '/') {
            return __dirname + '/' + s
        }
        else {
            return s
        }
    }
}

var init = {
    winston : function() {
        c.winston = {
            levels : {
                silly : 0,
                verbose : 1,
                info : 2,
                data : 3,
                warn : 4,
                debug : 5,
                error : 6
            },
            colors : {
                silly : 'magenta',
                verbose : 'cyan',
                info : 'green',
                data : 'grey',
                warn : 'yellow',
                debug : 'blue',
                error : 'red',
            }
        }
        winston = new (winston.Logger)({
            transports : [
                new (winston.transports.Console)({
                    colorize : true,
                })
            ],
            levels : c.winston.levels,
            colors : c.winston.colors
        })
    },
    sanitizePathsElm : function(elm) {
        if(elm.dest) {
            elm.dest = misc.returnFullPath(elm.dest)
        }
        if(elm.check) {
            elm.check = misc.returnFullPath(elm.check)
        }
        if(elm.relocate) {
            elm.relocate = misc.returnFullPath(elm.relocate)
        }
        for(var v in elm.glob) {
            elm.glob[v] = misc.returnFullPath(elm.glob[v])
        }
    },
    sanitizePaths : function() {
        _.each(c.directories, function(value,key,list) {
            var elm = value
            init.sanitizePathsElm(elm)
        })
        init.sanitizePathsElm(c)
        /*
        console.log(JSON.stringify(c,null,4))
        process.exit()
        */
    },
    watchers : function() {
        _.each(c.directories, function(value,key,list) {
            //    console.log(value,key,key[value],list)
            var watcher = new Watcher({ key: key, value: value })
        })
    },
    everything : function() {
        init.winston()
        winston.info('Initializing paths')
        init.sanitizePaths()
        winston.info('Initializing watchers')
        init.watchers()
    },
}


init.everything()
