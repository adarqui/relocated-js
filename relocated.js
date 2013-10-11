var glob = require('glob'),
    redis = require('redis'),
    resque = require('resque')
    fs = require('fs');

var c
if(process.env['CONFIG']) {
    c = require(process.env['CONFIG'])
}
else {
    c = require('./config.js')
}

console.log(c)
