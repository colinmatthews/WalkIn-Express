/**
 * Created by colin on 10/27/2016.
 */

var socket = io.connect();
socket.emit("getInitial");
// Triggers event in app.js to get initial data from the database.

Vue.component('new-appt',{
    props:['item'],
    template:'#new-appt'
});
// Component that appears when a new appointment is made/updated with a patient


var vm = new Vue({
    el: '#vue-instance',
    data: {
        inventory: [
        ]
    },
    created:function(){
        // triggers when the page is created

        socket.on("initRecords",function(data) {
            // Listens for event from app.js that sends all of the initial data from the database

            for (var i = 0; i < data.length; i++) {
                // populates local data with database info

                if(data[i].patient!=null) {
                    vm.inventory.push({
                        time: data[i].time, id: data[i].id, DOB: data[i].DOB, healthcard: data[i].healthcard,
                        phone: data[i].phone, address: data[i].address, name: data[i].name, patient: data[i].patient
                    });
                }

            }

            // Triggers event to listen for changes in appointments on app.js
            socket.emit("updateRecords");
        });

        // Listens for response from app.js for changes in appointments
        socket.on("updateRecordsResults",function(data){

            // if a new appointment is added
            if(data.old_val == null){
                console.log("here 1");
                if(data.new_val.patient!=null) {

                    vm.inventory.push({time: data.new_val.time, id: data.new_val.id});
                }
            }

            // if an existing appointment is deleted
            else if(data.new_val == null) {

                for (var i = 0; i < vm.inventory.length; i ++) {
                    console.log("here 2");
                    if (vm.inventory[i].id == data.old_val.id) {
                        vm.inventory.splice(i,1);
                    }
                }
            }

            // if an existing appointment is updated
            // This will be used most often, as we are updating existing appointments with new patients
            else{

                if(data.new_val.patient!=null && data.new_val.id == data.old_val.id) {

                    // Only adds the appointment to the local data if the patient isn't null, and the ids of the both the new and old data are the same
                    // this ensures that is is an update to an existing appointment

                    // It's steup this way because the appointments will be initialized before they have patients assigned to them by the clinic ( Dr x is available at 4pm)
                    // and we only want to display appointments with assigned patients, as this means they're booked

                    console.log("here 3")

                    socket.emit("getNewAppointmentPatient",data.new_val.patient);

                    // this triggers an event to get the associated patient information for the updated appointment


                    socket.on("newAppointmentPatientData",function(results){

                        // Listens for the results of the patient information for the updated appointment
                        // And then adds it to the local data (below for loop)

                        for(var n = 0; n < results.length ;n ++) {
                            vm.inventory.push({
                                time: data.new_val.time,
                                id: data.new_val.id,
                                DOB: results[n].DOB,    //
                                healthcard: results[n].healthcard,
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



