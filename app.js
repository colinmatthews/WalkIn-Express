/**
 * Simplified version of the original app.js
 * Auth0 authentication is bypassed for development purposes
 */

// Initialize Express
var express = require('express');
var app = express();
var http = require('http').Server(app);
var path = require('path');
var bodyParser = require('body-parser');
var helmet = require('helmet');

// Setup Middleware
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname + '/views'));
app.use("/public", express.static(__dirname + '/public'));

// Setup Routes
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/book', function(req, res) {
  res.render('book');
});

app.get('/success', function(req, res) {
  res.render('success');
});

app.get('/privacy', function(req, res) {
  res.render('privacy');
});

app.get('/error', function(req, res) {
  res.render('error');
});

app.get('/404', function(req, res) {
  res.render('404');
});

// Simplified dashboard routes - no authentication required for development
app.get('/dashboard', function(req, res) {
  res.render('dashboard', { user: { nickname: 'Developer' } });
});

app.get('/set', function(req, res) {
  res.render('set', { user: { nickname: 'Developer' } });
});

app.get('/dayview', function(req, res) {
  res.render('dayview', { user: { nickname: 'Developer' } });
});

// Handle 404 errors
app.use(function(req, res) {
  res.status(404);
  res.render('404');
});

// Launch Server
var port = process.env.PORT || 3000;
http.listen(port, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});

// Mock Socket.IO for client-side functionality
var io = require('socket.io')(http);
io.on("connection", function (socket) {
  console.log("Client connected");
  
  // Mock data for appointments
  const mockAppointments = [
    {
      id: "appt1",
      time: 9.5,
      displayTime: "9:30 AM",
      patient: null,
      viewed: false,
      timestamp: new Date()
    },
    {
      id: "appt2",
      time: 10,
      displayTime: "10:00 AM",
      patient: null,
      viewed: false,
      timestamp: new Date()
    },
    {
      id: "appt3",
      time: 11,
      displayTime: "11:00 AM",
      patient: null,
      viewed: false,
      timestamp: new Date()
    }
  ];
  
  // Mock data for booked appointments
  const mockBookedAppointments = [
    {
      id: "appt4",
      time: 13,
      displayTime: "1:00 PM",
      patient: "patient1",
      viewed: false,
      timestamp: new Date(),
      name: "John Doe",
      DOB: "01/15/1980",
      phone: "5551234567",
      address: "123 Main St",
      email: "john@example.com"
    }
  ];
  
  // Respond to client events with mock data
  socket.on("getDateAppointments", function() {
    socket.emit("initRecordsAppointments", mockAppointments);
  });
  
  socket.on("getInitialPatients", function() {
    socket.emit("initRecords", mockBookedAppointments);
  });
  
  socket.on("getBookedAppointments", function() {
    socket.emit("initBookedAppointmentsSet", mockBookedAppointments);
  });
  
  socket.on("getUnbookedAppointments", function() {
    socket.emit("initUnbookedAppointmentsSet", mockAppointments);
  });
  
  socket.on("updateRecordsSet", function() {
    // Mock implementation - no real updates needed for demo
  });
  
  socket.on("updateAppointmentsDashboard", function() {
    // Mock implementation - no real updates needed for demo
  });
  
  // Handle other socket events with empty implementations
  socket.on("createPatient", function(data) {
    socket.emit("newPatientID", "new-patient-id");
  });
  
  socket.on("assignAppointment", function() {
    // Mock implementation
  });
  
  socket.on("setViewed", function() {
    // Mock implementation
  });
  
  socket.on("deleteAppointment", function() {
    // Mock implementation
  });
  
  socket.on("confirmAppointment", function() {
    // Mock implementation
  });
  
  socket.on("denyAppointment", function() {
    // Mock implementation
  });
  
  socket.on("remakeAppointmentSlot", function() {
    // Mock implementation
  });
  
  socket.on("newAppointmentSlot", function() {
    // Mock implementation
  });
  
  socket.on("validateEmail", function() {
    socket.emit("validEmail");
  });
  
  socket.on("checkAvailability", function() {
    socket.emit("checkAvailabilityResults", null);
  });
  
  socket.on("closeCursor", function() {
    // Mock implementation
  });
});