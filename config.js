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
            redis : {
                host : "127.0.0.1",
                port : 6379,
                chan : {},
            },
        },
        movies : {
            glob : [
                'tmp_relocated/movies/*.mov',
                'tmp_relocated/movies/*/*.mov',
		'tmp_relocated/movies/rand/*',
            ],
            class : 'moviesClass',
            interval : 30,
            auth : {
                user : "admin",
                pass : "admin",
            }
        },
    },
    /* global, in case it isn't specified in the watcher */
    interval : 10,
    maxproc : 10,
    relocate : 'example/relocate',
    dest : 'tmp_relocated/misc/',
}
