/**
 * Created by colin on 10/27/2016.
 */

//### Initialization ###
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var r = require('rethinkdb');
var fs = require("fs");
var passport = require('passport');
var Auth0Strategy = require('passport-auth0');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var moment = require('moment');
var validator = require('validator');
var helmet = require('helmet');
var config = require('./middleware/config');
var SparkPost = require('sparkpost');
var ensureHTTPS = require('./middleware/ensureHTTPS');
var DEBUG = require('./middleware/debug');
var error404 = require('./middleware/error404');
var NeverBounce = require('neverbounce')({
    apiKey: config.neverBounce.apiKey,
    apiSecret: config.neverBounce.apiSecret
});


// ## Setup Middleware ##
app.use(ensureHTTPS(app.get('env')));
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname + '/views'));
app.use("/public", express.static(__dirname + '/public'));
app.use(cookieSession({
    name: 'das1daaf',
    keys: ['key1'],
    cookie: {
        secure: true,
        httpOnly: true,
        domain: domain, //
        expires: 24 * 60 * 60 * 1000 // 24 hours
    }
}));


// ## Setup Local Variables ##
var state = DEBUG(app.get('env'));
var domain = state.domain;
var appointments_table = state.appointments_table;
var patients_table = state.patients_table;
var client = new SparkPost(config.sparkpost.apiKey);



// ## Setup Passport and Auth0 ##
var strategy = new Auth0Strategy({
    domain:       process.env.AUTH0_DOMAIN,
    clientID:     process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL:  process.env.AUTH0_CALLBACK_URL || 'http://localhost:8000/callback'
}, function(accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in the most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user
    return done(null, profile);
});
passport.use(strategy);

// This can be used to keep a smaller payload
passport.serializeUser(function(user, done) {
    done(null, user);
});
passport.deserializeUser(function(user, done) {
    done(null, user);
});
app.use(passport.initialize());
app.use(passport.session());



// ## Setup Routes ##
var routes = require('./routes/indexRoutes');
var user = require('./routes/dashboardRoute');
app.use('/', routes);
app.use('/dashboard', user);
app.use(error404());


// ## Launch Server ##
var port = process.env.PORT;
http.listen(port || 8000, function(){
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
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
    var dbConfig = config.dbConfig;

    console.log("You connected!");



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
    socket.on("getInitialPatients", function (date) {
        if(dateIsValid(date)) {

            var validDate = moment.utc(date).toDate();

            console.log("Today in getInitialPatients");
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
                if (err) connectionError(err);
                rconnection = conn;
                // today's appointments that have patients that have not been viewed
                r.table(appointments_table).filter(r.row('timestamp').date().eq(new Date(validDate))).eqJoin
                ('patient', r.table(patients_table)).without({"right": {"id": true}}).zip()
                    .filter({viewed: false}).coerceTo('array').run(rconnection, function (err, cursor) {

                    if (err) queryError(err);
                    cursor.toArray(function (err, result) {
                        if (err) responseError(err);
                        console.log(result);
                        socket.emit("initRecords", result);

                    });
                });

            });
        }
        else{
            serverError("Error 1A, Invalid date when retrieving today's appointments.",new Error().stack);
        }
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
    socket.on("updateAppointmentsDashboard", function (date) {
        if(dateIsValid(date)) {

            var validDate = moment.utc(date).toDate();
            var testCursor;

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
                if (err) connectionError(err);
                rconnection = conn;

                r.table(appointments_table).filter(r.row('timestamp').date().eq(validDate))
                .changes().run(rconnection, function (err, cursor) {
                    if (err) {
                        console.log(new Error().stack);
                        console.log(" After query: "+err);
                    }
                    testCursor = cursor;
                    console.log(testCursor);
                    testCursor.each(function (err, result) {
                        if (err) {
                                console.log(new Error().stack);
                                console.log(" After cursor: "+err);

                        }
                        console.log(result);
                        socket.emit("updateAppointmentsDashboardResults", result);
                    });
                });
            });
        }
        else{
            serverError("Error 1B,Invalid date when retrieving today's appointments.",new Error().stack);
        }
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
                if (err) connectionError(err);
                rconnection = conn;
                r.table(patients_table).filter({id: patientID}).run(rconnection, function (err, cursor) {
                    if (err) queryError(err);
                    cursor.toArray(function (err, result) {
                        if (err) responseError(err);
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


    socket.on('confirmAppointment',function(userEmail,err) {
        if (err) serverError("Cannot confirm appointment.", new Error().stack);
        console.log("confirm");

        fs.readFile(__dirname + '/templates/acceptEmail.html', 'utf8', function (err, html) {
            client.transmissions.send({
                content: {
                    from: 'no-reply@walkinexpress.ca',
                    subject: 'Your Appointment Was Confirmed! See your next steps.',
                    html:html
                },
                recipients: [
                    {address: userEmail}
                ]
            });

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
        if(err)throw serverError("Cannot deny appointment",new Error().stack);
        console.log("deny");
        console.log(userEmail);

        fs.readFile(__dirname + '/templates/denyEmail.html', 'utf8', function (err, html) {
            client.transmissions.send({
                content: {
                    from: 'no-reply@walkinexpress.ca',
                    subject: 'Your Appointment Was Denied',
                    html: html
                },
                recipients: [
                    {address: userEmail}
                ]
            });
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
                if (err) connectionError(err);
                rconnection = conn;
                r.table(appointments_table).get(appointmentID).update({viewed: true}).run(rconnection, function (err, cursor) {
                    if (err) queryError(err);
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
        if(dateIsValid(date)) {
            var validDate = moment.utc(date).toDate();
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
                if (err) connectionError(err);
                rconnection = conn;

                console.log(time);

                r.table(appointments_table).insert({
                    "patient": null,
                    "time": 10,
                    "viewed": false,
                    "displayTime": displayTime,
                    timestamp: validDate
                }).run(rconnection, function (err, cursor) {
                    if (err) queryError(err);
                    console.log("NEW APPOINTMENT MADE " + cursor);
                });
            });
        }

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
        // date format is : yyyymmdd , string
        if(dateIsValid(date)){
            // take date string, turn it into a moment object, convert it to a javascript date and make it UTC
            // only other way is to parse date string manually and then create a date object by passing in each value

            var validDate = moment.utc(date).toDate();

            console.log(validDate);
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
                if (err) connectionError(err);
                rconnection = conn;
                // today's appointments that have patients that have not been viewed
                r.table(appointments_table).filter(r.row('timestamp').date().eq(validDate)).eqJoin
                ('patient', r.table(patients_table)).without({"right": {"id": true}}).zip()
                    .coerceTo('array').run(rconnection, function (err, cursor) {

                    if (err) queryError(err);
                    cursor.toArray(function (err, result) {
                        if (err) responseError(err);
                        console.log(result);
                        socket.emit("initBookedAppointmentsSet", result);
                    });
                });

            });
        }
        else {
            serverError("Error 1C,Invalid date when retrieving today's appointments.",new Error().stack);
        }
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
        // date format is : yyyymmdd , string
        if(dateIsValid(date)){
            // take date string, turn it into a moment object, convert it to a javascript date and make it UTC
            // only other way is to parse date string manually and then create a date object by passing in each value
            var validDate = moment.utc(date).toDate();
            console.log(validDate);
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
                if (err) connectionError(err);
                rconnection = conn;
                // today's appointments that have patients that have not been viewed
                r.table(appointments_table).filter({timestamp:validDate})
                    .filter({patient: null}).run(rconnection, function (err, cursor) {
                        if (err) queryError(err);
                        cursor.toArray(function (err, result) {
                            if (err) responseError(err);
                            console.log(result);
                            socket.emit("initUnbookedAppointmentsSet", result);
                        });
                    });

                });
        }
        else {
            serverError("Error 1D,Invalid date when retrieving today's appointments.",new Error().stack);
        }
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
        // date format is : yyyymmdd , string
        if(dateIsValid(date)){
            // take date string, turn it into a moment object, convert it to a javascript date and make it UTC
            // only other way is to parse date string manually and then create a date object by passing in each value
            var validDate = moment.utc(date).toDate();

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
                if (err) connectionError(err);
                rconnection = conn;
                r.db('WalkInExpress').table(appointments_table).filter(r.row('timestamp').date().eq(validDate))
                .changes().run(rconnection, function (err, cursor) {
                    console.log('here');
                    if (err) queryError(err);
                    myCursor=cursor;
                    myCursor.each(function (err, result) {
                        if (err) responseError(err);
                        console.log(" ***** " + result);
                        socket.emit("updateRecordsResultsSet", result);


                    });
                });
            });
        }

        else {
            serverError("Error 1E,Invalid date when retrieving today's appointments.",new Error().stack);
        }
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
                if (err) connectionError(err);
                rconnection = conn;
                r.table(appointments_table).get(appointmentID).delete().run(rconnection, function (err, cursor) {
                    if (err) queryError(err);
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
            if (err) connectionError(err);
            rconnection = conn;
            var displayTime;
            if( hour > 12){
                if( minute<10){
                    displayTime = (hour - 12) + ":0" + minute   + " " + period;
                }
                else{
                    displayTime = (hour - 12) + ":" + minute + " " + period;
                }
            }
            else{
                if( minute<10){
                    displayTime = hour + ":0" + minute  + " " + period;
                }
                else{
                    displayTime = hour + ":" + minute + " " + period;
                }

            }
            var time = hour + (minute/60);

            r.table(appointments_table).insert({
                "patient": null,
                "time": hour + (minute/60),
                "viewed": false,
                "displayTime": displayTime,
                timestamp: new Date(date+"UTC")
            }).run(rconnection, function (err, cursor) {
                if (err) queryError(err);
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
        // date format is : yyyymmdd , string
            if(dateIsValid(date)){
                // take date string, turn it into a moment object, convert it to a javascript date and make it UTC
                // only other way is to parse date string manually and then create a date object by passing in each value
                var validDate = moment.utc(date).toDate();

                console.log(validDate);
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
                    if (err) connectionError(err);
                    rconnection = conn;
                    r.table(appointments_table).filter(r.row('timestamp').date().eq(validDate))
                    .filter({patient: null}).orderBy('time').run(rconnection, function (err, cursor) {
                        if (err) queryError(err);
                        // implement next(err);
                        // and error handling
                        cursor.toArray(function (err, result) {
                            if (err) responseError(err);
                            console.log(result);
                            socket.emit("initRecordsAppointments", result);
                        });
                    });

                });

            }
            else {
                serverError("Error 1F,Invalid date when retrieving today's appointments.",new Error().stack);
            }

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


        var dob = data.DOB;
        var address = data.address;
        var name = data.name;
        var phone = data.phone;
        var email = data.email;

        if(dateIsValid(dob)) {

            if(!validator.isEmpty(address)){

                if(!validator.isEmpty(name)){

                    if(validator.isNumeric(phone)){

                        if (validator.isEmail(email)) {

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
                                if (err) connectionError(err);
                                rconnection = conn;
                                r.table(patients_table).insert({
                                    "DOB": data.DOB,
                                    "address": data.address,
                                    "doctor_id": data.doctor_id,
                                    "name": data.name,
                                    "phone": data.phone,
                                    "email": data.email
                                }).run(rconnection, function (err, cursor) {
                                    if (err) queryError(err);
                                    console.log("NEW PATIENT MADE ");
                                    var id = cursor.generated_keys[0];
                                    socket.emit("newPatientID", id);
                                    console.log(id);

                                });
                            });
                        }
                        else{
                            serverError("Invalid email.",new Error().stack);
                        }
                    }
                    else{
                        serverError("Invalid phone.",new Error().stack);
                    }

                }
                else{
                    serverError("Invalid name.",new Error().stack);
                }

            }
            else{
                serverError("Invalid address.",new Error().stack);
            }


        }
        else{
            serverError("Invalid Date of Birth.",new Error().stack);
        }

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
            if (err) connectionError(err);
            rconnection = conn;
            r.table(appointments_table).get(appointmentID).update({patient: patientID}).run(rconnection, function (err, cursor) {
                if (err) queryError(err);
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
            if (err) connectionError(err);
            rconnection = conn;
            r.table(appointments_table).get(appointmentID)("patient").run(rconnection, function (err, result) {
                if (err) queryError(err);
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
                serverError('Unable to contact email validation service', new Error().stack);
            }
        );

    });

    function dateIsValid(date) {
        // date is passed in as a string in the following format : "yyyymmdd"
        var checkDate = moment(date);
        // creating checkDate as a moment object allows us to use the isValid method to ensure the date is a valid date
        return (checkDate.isValid());
    }

    function serverError(message, err){
        if (app.get('env') === 'development')
        {
            socket.emit('errorRedirect', message, err);
        }
        else{
            socket.emit('errorRedirect', message,'');
        }
    }

    function connectionError(err){
        serverError('Cannot connect to the database.', err.stack);
    }

    function queryError(err){
        serverError('Cannot complete query.', err.stack);
    }

    function responseError(err){
        serverError('Cannot format query response.', err.stack);
    }


});


