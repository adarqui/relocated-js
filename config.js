module.exports = {
    interval : 3000,
    directories : {
        images : {
            glob : [ '/tmp/images/*.jpg' ],
            class : 'imageryClass',
            check : 'checker',
        },
        logs : {
            glob : [ '/tmp/logs/*.log' ],
            class : 'logsClass',
            check : 'checker',
        },
        movies : {
            glob : [
                '/tmp/movies/*.mov',
                '/tmp/movies/*/*.mov',
            ],
            class : 'moviesClass',
        },
        check : 'checker',
        relocate : 'relocate'
    }
}
