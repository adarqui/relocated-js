module.exports = {
    redis : {
        host : "127.0.0.1",
        port : 6379,
        chan : {},
    },
    directories : {
        images : {
            glob : [ '/tmp/images/*.jpg' ],
            class : 'imageryClass',
            check : '/tmp/bin/checker',
        },
        logs : {
            glob : [ '/tmp/logs/*.log' ],
            class : 'logsClass',
            check : '/tmp/bin/checker',
        },
        movies : {
            glob : [
                '/tmp/movies/*.mov',
                '/tmp/movies/*/*.mov',
            ],
            class : 'moviesClass',
            interval : 1,
        },
    },
    /* global, in case it isn't specified in the watcher */
    interval : 3,
    check : '/tmp/bin/checker',
    relocate : '/tmp/bin/relocate'
}
