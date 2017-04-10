/**
 * Created by colin on 10/27/2016.
 */

    //### Dashboard.js
    // ***
    // Dashboard.js contains all of the logic for the dashboard page. This includes vueJS frontend components
    // and socket.IO calls. There is also various helper functions used throughout the code.

//*** Variable Initialization ***



//Creates a new date object that only is formated as : mm/dd/yyyy
var today = new Date().toLocaleString([],{month:'2-digit',day:'2-digit',year:'numeric'});
console.log(today);
// Connects to the server file, app.js
var socket = io.connect();
// Calls the initial function for the page when the page loads, to get the initial appointments for today
socket.emit("getInitialPatients", today);






//***
//*** Vue JS Components and Functions ***

//#### new-appt ####
// new-appt is a vue component that appears when an appointment is booked. It comes with 3 functions: setViewed,
// confirmAppointment and denyAppointment. It passes an 'item', which is the appointment, in as a prop. It uses the
// html template "#new-appt", which can be found in dashboard.html
Vue.component('new-appt',{
    props:['item'],
    template:'#new-appt',
    methods:{
        //  ***setViewed***
        //
        //  **What:**
        //   Sends a request to the server to set the appointment as viewed in the database, and removes the appointment
        //   from the local array of appointments.
        //
        //  **Why:**
        //  To remove an appointment from the dashboard page
        //
        //**When:**
        //  When an appointment is accepted
        //
        setViewed:function(id){
            socket.emit("setViewed",id);
            for(var n=0;n<vm.inventory.length;n++){
                if(vm.inventory[n].id == id){
                    vm.inventory.splice(n,1);
                }
            }
        },
        //  ***confirmAppointment***
        //
        //  **What:**
        //   Send a request to the server to email the patient with a confirmation email
        //
        //
        //  **Why:**
        //  To confirm the appointment
        //
        //**When:**
        //  When an appointment is accepted
        //
        confirmAppointment:function(email){

            console.log(email);
            socket.emit("confirmAppointment",email);


        },
        //  ***denyAppointment***
        //
        //  **What:**
        //   Send a request to the server to email the patient with a deny email, then delete and recreate the appointment
        //   to remove the patient from that appointment
        //
        //  **Why:**
        //  To deny the appointment
        //
        //**When:**
        //  When an appointment is denied
        //
        denyAppointment:function(appointmentID, time, displayTime, email){
            console.log(email);
            socket.emit('denyAppointment',email);
            socket.emit('deleteAppointment',appointmentID);
            socket.emit('remakeAppointmentSlot',time,today,displayTime);
        }
    }
});


// #### vm ####
// vm is the instance of vue-js that contains the components, and anchors on to the html page. It contains the local data
//, as well as one large function. This function is called when the page is created, and moves through a series of function calls
// between the client and the server in a sequential manner.
var vm = new Vue({
    el: '#vue-instance',
    data: {
        inventory: [
        ]
    },
    created:function(){
        //  ***initRecords***
        //
        //  **What:**
        //   Adds all of the appointments that are returned to the local array, then calls the function to create an event listener for this page
        //
        //  **Why:**
        //  To add the appointments to the front-end
        //
        //**When:**
        //  After getInitialPatients returns its value
        //
        socket.on("initRecords",function(data) {
            for (var i = 0; i < data.length; i++) {
                if(data[i].patient!=null) {
                    vm.inventory.push({
                        time: data[i].time, id: data[i].id, DOB: data[i].DOB,
                        phone: data[i].phone, address: data[i].address, name: data[i].name, patient: data[i].patient,
                        displayTime:data[i].displayTime, email:data[i].email
                    });

                }
            }

            socket.emit("updateAppointmentsDashboard",today);
        });

        //  ***updateAppointmentsDashboardResults***
        //
        //  **What:**
        //   Adds all of the appointments that are returned to the local array from the event listener
        //
        //  **Why:**
        //  To add the appointments to the front-end as they are created
        //
        //**When:**
        //  After updateAppointmentsDashboard returns its value
        //
        socket.on("updateAppointmentsDashboardResults",function(data){

            /* if an existing appointment is deleted

             */
            if(data.new_val == null) {
                for (var i = 0; i < vm.inventory.length; i ++) {
                    if (vm.inventory[i].id == data.old_val.id) {
                        vm.inventory.splice(i,1);
                    }
                }
            }

            /* if a patient books an appointment

             */
            else{
                if(data.new_val.patient!=null && data.new_val.viewed == false) {
                    socket.emit("getPatient",data.new_val.patient);
                    socket.on("newAppointmentPatientData",function(results){

                        for(var n = 0; n < results.length ;n ++) {
                            vm.inventory.push({
                                time: data.new_val.time,
                                displayTime:data.new_val.displayTime,
                                id: data.new_val.id,
                                email: data.new_val.email,
                                DOB: results[n].DOB,
                                phone: results[n].phone,
                                address: results[n].address,
                                name: results[n].name,
                                patient: results[n].patient
                            });
                        }
                    });
                }

            }

        });
    }
});



