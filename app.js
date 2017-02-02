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
var SparkPost = require('sparkpost');
var client = new SparkPost('15756eb2514dee0c0c069401c1f49a99456f790c');


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


    var today = new Date().toLocaleString([],{month:'2-digit',day:'2-digit',year:'numeric'});;
    today = new Date(today + 'UTC');
    console.log(today);

    var rconnection = null;
    var myCursor = null;
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
            dashboard.js
    Function:
            Checks appointments table for a change in data for the current date
    Purpose:
            Used to check if any appointment data has changed,specifically looks for changes in
            the patient field from null to a pk of a patient. Works in conjunction with updateRecordsResults.
    Context:
            Called after getInitialPatients is called.
     */
    socket.on("updateRecordsDashboard", function () {
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
            r.db('WalkInExpress').table("appointments").filter(r.row('timestamp').date().eq(today)).changes().run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.each(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("updateRecordsResultsDashboard", result);
                });
            });
        });
    });

    /*
     Called From:
            dashboard.js
     Function:
            Checks appointments table for a change in data for the current date
     Purpose:
            Used to check if any appointment data has changed,specifically looks for changes in
            the patient field from null to a pk of a patient. Works in conjunction with updateRecordsResults.
     Context:
            Called after getInitialPatients is called.
     */

    socket.on('confirmAppointment',function(userEmail){
        console.log("confirm");

        client.transmissions.send({
            content: {
                from: 'testing@sparkpostbox.com',
                subject: 'Your Appointment Was Confirmed!',
                html:'<html><body>' +
                '<p> Your appointment has been confirmed!</p><br><p>Thanks for using Walk-In Express!</p></body></html>'
            },
            recipients: [
                {address: userEmail}
            ]
        });

    });

    socket.on('denyAppointment',function(userEmail){
        console.log("deny");

        client.transmissions.send({
            content: {
                from: 'testing@sparkpostbox.com',
                subject: 'Your Appointment Was Denied',
                html:'<html><body>' +
                '<p> There was a problem with your information when trying to book an appointment. Please visit the clinic to seek care while we try to sort this out!</p><br><p>Thanks for using Walk-In Express!</p></body></html>'
            },
            recipients: [
                {address: userEmail}
            ]
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
            // today's appointments that have patients that have not been viewed
            r.table('appointments').filter(r.row('timestamp').date().eq(today)).eqJoin
                ('patient', r.table('patients')).without({"right": {"id": true}}).zip()
                .filter({viewed: false}).coerceTo('array').run(rconnection, function (err, cursor) {

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
     Called From:
            set.js
     Function:
            Joins patient and appointment data for all appointments that have patients
     Purpose:
            Used to initialize set with booked appointments
     Context:
           Called at the beginning of the file


     */
    socket.on("initAppointmentsSet", function (date) {
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
            // today's appointments that have patients that have not been viewed
            r.table('appointments').filter(r.row('timestamp').date().eq(new Date(date+"UTC"))).eqJoin
            ('patient', r.table('patients')).without({"right": {"id": true}}).zip()
                .coerceTo('array').run(rconnection, function (err, cursor) {

                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("initRecordsSet", result);
                });
            });

        });
    });


    /*
     Called From:
            set.js
     Function:
             Checks appointments table for a change in data for the current date
     Purpose:
            Used to check if any appointment data has changed,specifically looks for changes in
            the patient field from null to a pk of a patient. Works in conjunction with updateRecordsResults.
     Context:
            Called after getInitialPatients is called.
     */
    socket.on("updateRecordsSet", function (date) {
        var checkDate = new Date(date +'UTC');
        console.log(checkDate);

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
            r.db('WalkInExpress').table("appointments").filter(r.row('timestamp').date().eq(checkDate)).changes().run(rconnection, function (err, cursor) {
                console.log('here');
                if (err) throw err;
                myCursor=cursor;
                myCursor.each(function (err, result) {
                    if (err) throw err;
                    console.log(" ***** " + result);
                    socket.emit("updateRecordsResultsSet", result);

                });
            });
        });
    });

    /*
    Called by:
            set.js
    Function:
            Closes the current cursor
    Purpose:
            Used to close the changes query when changing dates, so that there is only ever one changefeed at a time
            and that changefeed is set to the date the user is current working with

     */
    socket.on("closeCursor", function () {
       console.log(myCursor.close());
    });


    /*
     Called by:
            set.js
     Function:
           Gets all the appointments on a specific date
     Purpose:
            Used to get all appointments that do not have patients booked
     Context:
            Called after initAppointmentsSet

     */
    socket.on("getDateAppointments", function (date) {

        var checkDate = new Date(date +'UTC');
        console.log(checkDate);
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
            r.table('appointments').filter(r.row('timestamp').date().eq(checkDate)).run(rconnection, function (err, cursor) {
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
        console.log(date);
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
                timestamp: new Date(date+"UTC"),
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

