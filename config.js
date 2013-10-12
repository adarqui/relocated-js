module.exports = {
    namespace : 'relocated',
    redis : {
        host : "127.0.0.1",
        port : 6379,
        chan : {},
    },
    directories : {
        images : {
            namespace : 'relocated_images',
            glob : [ 'tmp_relocated/images/*.jpg' ],
            class : 'imageryClass',
            check : 'example/checker',
            dest : 'tmp_relocated/images_processed/',
            redis : {
                host : "127.0.0.1",
                port : 6379,
                chan : {}
            }
        },
        logs : {
            glob : [ 'tmp_relocated/logs/*.log' ],
            class : 'logsClass',
            check : 'example/checker',
            redis : {
                host : "127.0.0.1",
                port : 6379,
                chan : {},
            },
            interval : 4
        },
        movies : {
            glob : [
                'tmp_relocated/movies/*.mov',
                'tmp_relocated/movies/*/*.mov',
            ],
            class : 'moviesClass',
            interval : 2,
            auth : {
                user : "admin",
                pass : "admin",
            }
        },
    },
    /* global, in case it isn't specified in the watcher */
    interval : 6,
    check : 'example/checker',
    relocate : 'example/relocate',
    dest : '/tmp/misc/',
}
