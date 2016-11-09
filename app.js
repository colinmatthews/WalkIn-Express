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
app.use("/public", express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/set', function (req, res) {
    res.sendFile(__dirname + '/views/set.html');
});

var dbConfig = {
    host: 'rethinkdb.southcentralus.cloudapp.azure.com',
    port: 28015,
    db: 'test'
};
var rconnection = null;

io.on("connection",function(socket) {
    console.log("You connected!");

    socket.on("getInitial", function () {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').eqJoin('patient',r.table('patients')).without({"right": {"id": true}}).zip().filter({viewed:false}).coerceTo('array').run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("initRecords", result);
                });
            });

        });
    });

    socket.on("updateRecords", function () {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.db('test').table("appointments").changes().run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.each(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("updateRecordsResults", result);
                });
            });
        });
    });

    socket.on("getNewAppointmentPatient",function(patientID) {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('patients').filter({id: patientID}).run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("newAppointmentPatientData", result);

                });
            });
        });
    });

    socket.on("getInitialAppointments", function () {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("initRecordsAppointments", result);
                });
            });

        });
    });

    socket.on("deleteAppointment", function (appointmentID) {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').get(appointmentID).delete().run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("DELETE APPOINTMENT DATA "+cursor);
                });
            });
        });

    socket.on("setViewed",function(appointmentID){
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').get(appointmentID).update({viewed:true}).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("UPDATE APPOINTMENT VIEWED "+cursor);
            });
        });
    });

    socket.on("newAppointmentSlot",function (appointmentTime) {
        r.connect({host: dbConfig.host, port: dbConfig.port}, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').insert({
                "doctor": "75873b43-51b8-4614-9603-a2ac74e81c0d",
                "patient": "null",
                "time": appointmentTime,
                "viewed": false
                }).run(rconnection, function (err, cursor) {
                    if (err) throw err;
                    console.log("NEW APPOINTMENT MADE " + cursor);
                });
        });

    });

});

console.log("App listening on port" + port);

