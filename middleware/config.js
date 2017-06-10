/**
 * Created by C on 2017-06-09.
 */
var fs = require("fs");
var config = {};

var caCert = config.caCert = fs.readFileSync(__dirname + '/cacert.txt').toString().trim();
var dbCredentials = JSON.parse(fs.readFileSync('./middleware/dbConfig.json', 'utf8'));


config.dbConfig = {
    host: dbCredentials.host,
    port: dbCredentials.port,
    user: dbCredentials.user,
    password: dbCredentials.password,
    db: dbCredentials.db,
    ssl: {
        ca: caCert
    }
};

config.neverBounce = {
    apiKey: 'Bp4jC20K',
    apiSecret: 'Yzu8C125gtbYR4F'
};

config.sparkpost ={
    apiKey : 'fc909733b7ae2f4481fd7317bed0e7281d65d427'
};


module.exports = config;