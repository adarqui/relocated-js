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
    events = require('events'),
    fs = require('fs');

var c;

var Watcher = function(elm) {
    var self = this
    self.key = elm.key
    self.dir = elm.value
    self.interval = 1
    self.maxproc = 0
    self.relocate = function() { return null }
    self.dest = null
    self.glob = {}
    self.namespace = "relocated"
    self.resque = {}
    self.ev = {}
    self.execQueue = []

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

    self.redisRelocateFailed = function(elm,cb) {
        winston.error('Relocate: '+elm.me+' failed')
        self.redis.chan.sadd(self.namespace + ':' + 'relocate:failed', elm.me, function(err,dat) {
            if(err) {
                winston.error('Relocate: '+elm.me+' failed -> redis')
            }
        })
    }

    self.execRelocate = function(elm) {
        var code = self.relocate()
        cproc.exec(code + ' ' + elm.me + ' ' + self.dir.class + ' ' + self.dest + ' ' + self.key, function(err,stdout,stderr) {
            if(err && err.code == 1) {
                // relocate failure
                self.redisRelocateFailed(elm, self.processExecQueue)
            } else {
                // relocate success
                var js = null
                if(typeof stdout === 'string') {
                    js = JSON.parse(stdout)

                }

                try {
                    self.resque.enqueue('relocated',self.class,js)
                } catch(err) {
                    /* why does resque not supply a callback? */
                    winston.error('Resque: '+self.me+' failed')
                }
                self.redisRelocateSuccess(elm,self.processExecQueue)
            }
        })
    }

    self.processGlobFile = function(file,cb) {
        var elm
        var st

        elm = self.glob[file]

        if(elm) {

            if(elm.done) return cb();

           fs.stat(file, function(err,data) {
               if(elm.size == data.size) {
                   elm.done = true
                   self.ev.emit('exec', { element : elm })
                   return cb()
               }
               elm.size = data.size
               return cb()
           })
        }
        else {
            fs.stat(file, function(err,data) {
                self.glob[file] = data
                self.glob[file].me = file
                return cb()
            })
        }

        return cb()
    }
    self.initGlob = function() {

      for(var v in self.dir.glob){
          var dir = self.dir.glob[v]
          glob(dir,{},function(err,files) {
              async.forEachSeries(files,function(file,_cb) {
                 async.setImmediate(function() {
                    return self.processGlobFile(file,_cb);
                 })
              })
          })
      }
    }
    self.initInterval = function() {
        setInterval(function() {
            self.initGlob()
        }, self.interval*1000)
    }
    self.processExecQueue = function() {
        if(self.execQueue.length > 0) {
            var elm = self.execQueue.pop()
            self.execRelocate(elm)
        }
    },
    self.pushExecQueue = function(elm) {
        self.execQueue.push(elm)
    }
    self.initEventHooks = function() {
        self.ev.on('exec', function(data) {
            self.pushExecQueue(data.element)
            if(self.execQueue.length > self.maxprocs) {
                /* too many processes currently running... return */
                return
            }

            self.processExecQueue()
        })
    }
    self.init = function() {

        self.ev = new events.EventEmitter()
        self.initEventHooks()

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

        if(self.dir.maxproc) {
            self.maxproc = self.dir.maxproc
        } else if(c.maxproc) {
            self.maxproc = c.maxproc
        } else {
            winston.error('Init: '+elm.key+' maxproc -> unspecified')
            process.exit()
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

        self.resque = resque.connect({ redis : self.redis.chan })

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
    },
    watchers : function() {
        _.each(c.directories, function(value,key,list) {
            var watcher = new Watcher({ key: key, value: value })
        })
    },
    eventEmitter : function() {
        /* global event emitter, may not need this */
        c.ev = new events.EventEmitter()
    },
    config : function() {
        if(process.env['CONFIG']) {
            c = require(process.env['CONFIG'])
        } else {
            c = require('./config.js')
        }
    },
    everything : function() {
        init.config()
        init.winston()
        init.eventEmitter()
        winston.info('Initializing paths')
        init.sanitizePaths()
        winston.info('Initializing watchers')
        init.watchers()
    },
}


init.everything()
