/**
 * Created by colin on 10/27/2016.
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var r = require('rethinkdb');


var port = 8000;
http.listen(port);
app.use(express.static(path.join(__dirname, '/public')));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/views/index.html');
});

var dbConfig = {
    host: 'rethinkdb.southcentralus.cloudapp.azure.com',
    port: 28015,
    db: 'test'
};
var rconnection = null;



io.on("connection",function(socket) {
    console.log("You connected!");

    socket.on("getDoctors", function () {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.db('test').table('doctors').run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("initDoctors", result);
                });
            });

        });
    });

    socket.on("updateDoctors", function () {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.db('test').table('doctors').changes().run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.each(function (err, result) {
                    if (err) throw err;
                    socket.emit("updateDoctorsResults", result);
                });
            });
        });
    });
});

console.log("App listening on port" + port);

