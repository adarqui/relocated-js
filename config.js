module.exports = {
    namespace : 'relocated',
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
            dest : '/tmp/images_processed/',
            redis : {
                host : "127.0.0.1",
                port : 6379,
                chan : {}
            }
        },
        logs : {
            glob : [ '/tmp/logs/*.log' ],
            class : 'logsClass',
            check : '/tmp/bin/checker',
            redis : {
                host : "127.0.0.1",
                port : 6379,
                chan : {},
            },
        },
        movies : {
            glob : [
                '/tmp/movies/*.mov',
                '/tmp/movies/*/*.mov',
            ],
            class : 'moviesClass',
            interval : 2,
        },
    },
    /* global, in case it isn't specified in the watcher */
    interval : 3,
    check : '/tmp/bin/checker',
    relocate : '/tmp/bin/relocate',
    dest : '/tmp/misc/',
}
