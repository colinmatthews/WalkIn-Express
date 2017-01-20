/**
 * Created by colin on 10/27/2016.
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var r = require('rethinkdb');
var fs = require("fs")
var stormpath = require('express-stormpath');


var port = 8000;

app.use(stormpath.init(app, {
    website:true

}));

app.use("/public", express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/views/index.html');
});

app.get('/book', stormpath.loginRequired, function (req, res) {
    res.sendFile(__dirname + '/views/book.html');
});

app.get('/dashboard',stormpath.groupsRequired(['clinics']), function (req, res) {
    res.sendFile(__dirname + '/views/dashboard.html');
});

app.get('/set',stormpath.groupsRequired(['clinics']), function (req, res) {
    res.sendFile(__dirname + '/views/set.html');
});

app.get('/dayview',stormpath.groupsRequired(['clinics']), function (req, res) {
    res.sendFile(__dirname + '/views/dayview.html');
});

http.listen(port);



app.on('stormpath.ready', function () {
    console.log('Stormpath Ready!');
});

io.on("connection", function (socket) {
    var rconnection = null;
    console.log("You connected!");


    var caCert = fs.readFileSync(__dirname + '/cacert.txt').toString().trim();

    var dbConfig = {
        host: 'aws-us-east-1-portal.11.dblayer.com',
        port: 15568,
        user: 'colin',
        password: "9753186420TQRs",
        db: "WalkInExpress",
        ssl: {
            ca: caCert
        }
    };

    //*********************************
    //
    //          Dashboard.js
    //
    //*********************************

    /*
    Called From:
            dashboard.js, set.js
    Function:
            Checks appointments table for a change in data
    Purpose:
            Used to check if any appointment data has changed,specifically looks for changes in
            the patient field from null to a pk of a patient. Works in conjunction with updateRecordsResults.
    Context:
            Called after initRecords is called.
     */
    socket.on("updateRecords", function () {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.db('WalkInExpress').table("appointments").changes().run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.each(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("updateRecordsResults", result);
                });
            });
        });
    });


    /*
    Called from:
            dashboard.js
    Function:
            Gets data for a specific patient ID
    Purpose:
            If an existing appointment is updated, and a patient is added to that appointment, this function is called
            to get the corresponding patient information
    Context:
            Called after updateRecordsResult

     */

    socket.on("getNewAppointmentPatient", function (patientID) {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
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

    /*
     Called by:
            dashboard.js
     Function:
            sets the 'viewed' property on an appointment to true
     Purpose:
            a viewed appointment will not appear on the dashboard (must be dismissed by user)
     Context:
            part of the appointment template on dashboard.html, and the appointment component
     */
    socket.on("setViewed", function (appointmentID) {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').get(appointmentID).update({viewed: true}).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("UPDATE APPOINTMENT VIEWED " + cursor);
            });
        });
    });

    /*
     Called by:
            dashboard.js
     Function:
            gets initial data for appointments that have patients associated with them
     Purpose:
            initializes dashboard with bookings
     Context:
            called at the beginning of dashboard.js
     */
    socket.on("getInitialPatients", function () {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').eqJoin('patient', r.table('patients')).without({"right": {"id": true}}).zip().filter({viewed: false}).coerceTo('array').run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("initRecords", result);
                });
            });

        });
    });


    //*********************************
    //
    //          set.js
    //
    //*********************************


    /*
     Called by:
            set.js
     Function:
            Gets initial appointment data
     Purpose:
            Populate existing appointments
     Context:
           cCalled at the beginning of set.js
     */
    socket.on("getInitialAppointments", function () {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
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


    /*
    Called by:
            set.js
    Function:
            deletes an appointment by pk
    Purpose:
            delete an existing appointment
    Context:
            can be called at any time by the user, part of the appointment template
     */
    socket.on("deleteAppointment", function (appointmentID) {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').get(appointmentID).delete().run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("DELETE APPOINTMENT DATA " + cursor);
            });
        });
    });

    /*
    Called by:
            set.js
    Function:
            creates a new appointment record
    Purpose:
            allows a user to create a new appointment time

     */
    socket.on("newAppointmentSlot", function (appointmentTime,date) {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            var displayTime;

            if (appointmentTime == 12) {
                displayTime = appointmentTime + "PM";
            }
            else if (appointmentTime == 24) {
                displayTime = appointmentTime - 12 + "AM";
            }
            else if (appointmentTime >= 13) {
                displayTime = appointmentTime - 12 + "PM";
            }

            else {
                displayTime = appointmentTime + "AM";
            }
            r.table('appointments').insert({
                "patient": null,
                "time": appointmentTime,
                "viewed": false,
                "displayTime": displayTime,
                timestamp: new Date(date),
            }).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("NEW APPOINTMENT MADE " + cursor);
            });
        });

    });

    //*********************************
    //
    //          book.js
    //
    //*********************************


    /*
    Called by:
            book.js
    Function:
            Creates a new patient record
    Purpose:
            Create a new patient record, which will then be assigned to an appointment
    Context:
        Called after a user submits the form to book a specific appointment
     */

    socket.on("createPatient", function (data) {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('patients').insert({
                "DOB": data.DOB,
                "address": data.address,
                "doctor_id": data.doctor_id,
                "healthcard": data.healthcard,
                "name": data.name,
                "phone": data.phone
            }).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("NEW PATIENT MADE ");
                var id = cursor.generated_keys[0];
                socket.emit("newPatientID", id);
                console.log(id);

            });
        });

    });


    /*
    Called by:
            book.js
    Function:
            assigns an appointment to a specific patient by pk of each
    Purpose:
            connects the patient to the appointment they booked
    Context:
            called after a new patient is created

     */
    socket.on("assignAppointment", function (patientID, appointmentID) {
        r.connect({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password,
            db: dbConfig.db,
            ssl: {
                ca: dbConfig.ssl.ca
            }
        }, function (err, conn) {
            if (err) throw err;
            rconnection = conn;
            r.table('appointments').get(appointmentID).update({patient: patientID}).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("UPDATE APPOINTMENT VIEWED " + cursor);
            });
        });

    });




});

console.log("App listening on port" + port);

