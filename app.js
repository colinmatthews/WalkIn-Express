/**
 * Created by colin on 10/27/2016.
 */

//### Initialization
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var r = require('rethinkdb');
var fs = require("fs")
var stormpath = require('express-stormpath');


// Sparkpost is used for sending emails to the patients
var SparkPost = require('sparkpost');
var client = new SparkPost('15756eb2514dee0c0c069401c1f49a99456f790c');

var NeverBounce = require('neverbounce')({
    apiKey: 'Bp4jC20K',
    apiSecret: 'Yzu8C125gtbYR4F'
});


app.use(function (req, res, next) {
    var sslUrl;

    if (process.env.NODE_ENV === 'production' &&
        req.headers['x-forwarded-proto'] !== 'https') {

        sslUrl = ['https://www.walkinexpress.ca', req.url].join('');
        return res.redirect(sslUrl);
    }

    return next();
});

var port = process.env.PORT;
http.listen(port || 8000, function(){
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
// Stormpath is used for our user authentication
app.use(stormpath.init(app, {
    website:true

}));



app.use("/public", express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/views/index.html');
});
//Adding `stormpath.loginRequired` make this route only accessible to logged in users
app.get('/book',function (req, res) {
    res.sendFile(__dirname + '/views/book.html');
});

app.get('/success',function (req, res) {
    res.sendFile(__dirname + '/views/success.html');
});

app.get('/failure',function (req, res) {
    res.sendFile(__dirname + '/views/failure.html');
});

// `groupsRequired[('clinics)]` makes this route only accessible to users who are a part of the clinics group
app.get('/dashboard',stormpath.groupsRequired(['clinics']), function (req, res) {
    res.sendFile(__dirname + '/views/dashboard.html');
});

app.get('/set',stormpath.groupsRequired(['clinics']), function (req, res) {
    res.sendFile(__dirname + '/views/set.html');
});

app.get('/privacy', function (req, res) {
    res.sendFile(__dirname + '/views/privacy.html');
});


app.get('/dayview',stormpath.groupsRequired(['clinics']), function (req, res) {
    res.sendFile(__dirname + '/views/dayview.html');
});

//http.listen(port);



app.on('stormpath.ready', function () {
    console.log('Stormpath Ready!');
});



//# Socket IO Calls
//***
//  Socket is used to make calls to our database, which are triggered by the client. Its uses an event-driven approach
//so these functions will only be called when particular events occur ( button click, page load, etc)
io.on("connection", function (socket) {

    // rconnection and myCursor are used when connecting to rethinkDB, so that we can access the connection or the cursor
    // if we need to.
    //  rconnection is the connection to the database, and myCursor is an listener object that is
    // created when we run a query with `.changes()` at the end of it.
    var rconnection = null;
    var myCursor = null;
    console.log("You connected!");

    // caCert is a SSL certificate for connecting to db
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

    //### Dashboard.js
    //***
    // The following function calls are called from dashboard.js


    // ***getInitialPatients***
    //
    //
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
    socket.on("getInitialPatients", function (today) {
        console.log("Today in getInitialPatients");
        console.log(today);
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
            r.table('appointments').filter(r.row('timestamp').date().eq(new Date(today+"UTC"))).eqJoin
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

    //
    //  ***updateAppointmentsDashboard***
    //
    //  **What:**
    //  Checks appointments table for a change in data for the current date by creating a listener object
    // for the appointments table, filtered to today's date
    //
    //  **Why:**
    //  Used to check if any appointment data has changed, specifically looks for changes in
    //the patient field from null to a pk of a patient. Works in conjunction with updateRecordsResults.
    //
    //**When:**
    //  Called after getInitialPatients is called.
    //
    socket.on("updateAppointmentsDashboard", function (today) {
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
            r.db('WalkInExpress').table("appointments").filter(r.row('timestamp').date().eq(new Date(today+"UTC"))).changes().run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.each(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("updateAppointmentsDashboardResults", result);
                });
            });
        });
    });

    //  ***getPatient***
    //
    //  **What:**
    //   Gets data for a specific patient ID
    //
    //  **Why:**
    //  If an appointment has a patient assigned to it, this function is called
    //to get the patients information
    //
    //**When:**
    //   After updateAppointmentsDashboardResults is received by the client
    //

    socket.on("getPatient", function (patientID) {
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

    //  ***confirmAppointment***
    //
    //  **What:**
    //   Sends an email to the patient confirming their appointment
    //
    //  **Why:**
    //  Allows communication between the patient and the clinic, and give the patient peace of mind their appointment
    //  has been received.
    //
    //**When:**
    //  Called when the "Accept" button on the dashboard is clicked.
    //


    socket.on('confirmAppointment',function(userEmail,err){
        if(err)throw err;
        console.log("confirm");

        client.transmissions.send({
            content: {
                from: 'testing@walkinexpress.ca',
                subject: 'Your Appointment Was Confirmed!',
                html:'<html><body>' +
                '<p> Your appointment has been confirmed!</p><br><p>Thanks for using Walk-In Express!</p></body></html>'
            },
            recipients: [
                {address:userEmail}
            ]
        });

    });

    //  ***denyAppointment***
    //
    //  **What:**
    //   Sends an email to the patient denying their appointment
    //
    //  **Why:**
    //  Allows communication between the patient and the clinic. Their appointment was likely denied due to the information
    //  they entered was false.
    //
    //**When:**
    //  Called when the "Decline" button on the dashboard is clicked.
    //

    socket.on('denyAppointment',function(userEmail, err){
        if(err)throw err;
        console.log("deny");
        console.log(userEmail);
        client.transmissions.send({
            content: {
                from: 'testing@walkinexpress.ca',
                subject: 'Your Appointment Was Denied',
                html:'<html><body>' +
                '<p> There was a problem with your information when trying to book an appointment. Please visit the clinic to seek care while we try to sort this out!</p><br><p>Thanks for using Walk-In Express!</p></body></html>'
            },
            recipients: [
                {address: userEmail}
            ]
        });

    });


    //  ***setViewed***
    //
    //  **What:**
    //   Sets the *viewed* value on an appointment to true
    //
    //  **Why:**
    //  Once an appointment has been accepted or declined, setting the *viewed* value dismisses the appointment popup
    //
    //**When:**
    //   After the "Accept" or "Decline" button has been clicked
    //

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

    //  ***remakeAppointmentSlot***
    //
    //  **What:**
    //   Recreates an appointment that will be soon deleted
    //
    //  **Why:**
    //  After the clinic denies an appointment, this method is called to recreate the denied appointment
    //
    //**When:**
    //  On deny appointment
    //

    socket.on("remakeAppointmentSlot", function (time,date,displayTime) {
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

            r.table('appointments').insert({
                "patient": null,
                "time": time,
                "viewed": false,
                "displayTime": displayTime,
                timestamp: new Date(date+"UTC")
            }).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("NEW APPOINTMENT MADE " + cursor);
            });
        });

    });





    //### Set.js
    //***
    // The following function calls are called from set.js


    //  ***getBookedAppointments***
    //
    //  **What:**
    //   Returns all of the booked appointments for a given date
    //
    //  **Why:**
    //  Populate booked appointments on the schedule page
    //
    //**When:**
    //  On the schedule page load
    //


    socket.on("getBookedAppointments", function (date) {
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
                    socket.emit("initBookedAppointmentsSet", result, date);
                });
            });

        });
    });

    //  ***getUnbookedAppointments***
    //
    //  **What:**
    //   Returns all of the unbooked appointments for a given date
    //
    //  **Why:**
    //  Populate unbooked appointments on the schedule page
    //
    //**When:**
    //  After booked appointments are initialized
    //

    socket.on("getUnbookedAppointments", function (date) {
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
            r.table('appointments').filter(r.row('timestamp').date().eq(new Date(date+"UTC")))
                .filter({patient: null}).run(rconnection, function (err, cursor) {

                    if (err) throw err;
                    cursor.toArray(function (err, result) {
                        if (err) throw err;
                        console.log(result);
                        socket.emit("initUnbookedAppointmentsSet", result, date);
                    });
                });

        });
    });


    //  ***updateRecordsSet***
    //
    //  **What:**
    //   Creates an event listener for changes in today's appointments
    //
    //  **Why:**
    //  To add /remove appointments from the front end
    //
    //**When:**
    //  After unbooked appointments are added to the schedule
    //
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

    ///  ***closeCursor***
    //
    //  **What:**
    //   Closes the current rethinkdb cursor ( event listener object)
    //
    //  **Why:**
    //  To maintain only one event listener ever being active at any given time
    //
    //**When:**
    //  On date change
    //
    socket.on("closeCursor", function () {
       console.log(myCursor.close());
    });



    //  ***deleteAppointment***
    //
    //  **What:**
    //   Deletes an appointment
    //
    //  **Why:**
    //  Clinic wants to delete appointment, or denies appointment
    //
    //**When:**
    //  On delete button
    //
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

    //  ***newAppointmentSlot***
    //
    //  **What:**
    //   Creates a new appointment slot
    //
    //  **Why:**
    //  To make appointment slots available for booking
    //
    //  **When:**
    //  After the clinic clicks " Add new appointment" and confirms an appointment time
    //
    socket.on("newAppointmentSlot", function (hour,minute,date,period) {
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
            if( hour > 12){
                if( minute == 0){
                    displayTime = (hour - 12) + ":" + minute + '0'  + " " + period;
                }
                else{
                    displayTime = (hour - 12) + ":" + minute + " " + period;
                }
            }
            else{
                if( minute == 0){
                    displayTime = hour + ":" + minute + '0' + " " + period;
                }
                else{
                    displayTime = hour + ":" + minute + " " + period;
                }

            }

            r.table('appointments').insert({
                "patient": null,
                "time": hour + (minute/60),
                "viewed": false,
                "displayTime": displayTime,
                timestamp: new Date(date+"UTC")
            }).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("NEW APPOINTMENT MADE " + cursor);
            });
        });

    });






    //  ***getDateAppointments***
    //
    //  **What:**
    //   Get all the unbooked appointments for given date
    //
    //  **Why:**
    //  Populate unbooked appointments for booking page
    //
    //  **When:**
    //  On page load
    //
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
            r.table('appointments').filter(r.row('timestamp').date().eq(checkDate)).filter({patient: null}).run(rconnection, function (err, cursor) {
                if (err) throw err;
                cursor.toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    socket.emit("initRecordsAppointments", result);
                });
            });

        });
    });





    //  ***createPatient***
    //
    //  **What:**
    //  Create a new patient
    //
    //  **Why:**
    //  Creates a new patient object to be later assigned to the appointment
    //
    //  **When:**
    //  After filling out booking form, and clicking "Book!"
    //

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
                "phone": data.phone,
                "email":data.email
            }).run(rconnection, function (err, cursor) {
                if (err) throw err;
                console.log("NEW PATIENT MADE ");
                var id = cursor.generated_keys[0];
                socket.emit("newPatientID", id);
                console.log(id);

            });
        });

    });


    //  ***assignAppointment***
    //
    //  **What:**
    //   Assign patient to appointments 'patient' field by id
    //
    //  **Why:**
    //  To book an appointment
    //
    //  **When:**
    //  After a new patient is created from filling out the booking form
    //
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

    //  ***checkAvailability***
    //
    //  **What:**
    //   Checks to see if an appointment has a patient assigned to it
    //
    //  **Why:**
    //  When booking appointments, this check ensures that two patients cant book the same appointment
    //
    //  **When:**
    //  After the form data from the book page is validated
    //

    socket.on("checkAvailability",function (appointmentID) {
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
            r.table('appointments').get(appointmentID)("patient").run(rconnection, function (err, result) {
                if (err) throw err;
                console.log(result);
                socket.emit("checkAvailabilityResults", result);

            });
        });

    });

    //  ***validateEmail***
    //
    //  **What:**
    //   Validates an email using neverbounce
    //
    //  **Why:**
    //  To validate that the email that was entered exists
    //
    //  **When:**
    //  After the regex checks are applied
    //

    socket.on("validateEmail",function (email) {
        NeverBounce.single.verify(email).then(
            function(result) {
                if(result.is(0)){
                    socket.emit('validEmail');
                }
                else{
                    console.log(result);
                    socket.emit('invalidEmail');
                }
            },
            function(error) {
                // errors will bubble up through the reject method of the promise.
                // you'll want to console.log them otherwise it'll fail silently
                console.log(error);
            }
        );

    });


});


