/**
 * Created by colin on 10/27/2016.
 */

var socket = io.connect();
socket.emit("getInitialPatients");
// Triggers event in app.js to get initial data from the database.

Vue.component('new-appt',{
    props:['item'],
    template:'#new-appt',
    methods:{
        setViewed:function(id){
            socket.emit("setViewed",id);
            for(var n=0;n<vm.inventory.length;n++){
                if(vm.inventory[n].id == id){
                    vm.inventory.splice(i,1);
                }
            }
        }
    }
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
            for (var i = 0; i < data.length; i++) {
                if(data[i].patient!=null) {
                    vm.inventory.push({
                        time: data[i].time, id: data[i].id, DOB: data[i].DOB, healthcard: data[i].healthcard,
                        phone: data[i].phone, address: data[i].address, name: data[i].name, patient: data[i].patient,
                        displayTime:data[i].displayTime
                    });

                }
            }

            socket.emit("updateRecordsDashboard");
        });

        // Listens for response from app.js for changes in appointments
        socket.on("updateRecordsResultsDashboard",function(data){

            // if a new appointment is added
            if(data.old_val == null){
                if(data.new_val.patient!=null) {
                    vm.inventory.push({time: data.new_val.time, id: data.new_val.id});
                }
            }

            // if an existing appointment is deleted
            else if(data.new_val == null) {
                for (var i = 0; i < vm.inventory.length; i ++) {
                    if (vm.inventory[i].id == data.old_val.id) {
                        vm.inventory.splice(i,1);
                    }
                }
            }

            // if an existing appointment is updated
            else{
                if(data.new_val.patient!=null && data.new_val.viewed == false) {
                    socket.emit("getNewAppointmentPatient",data.new_val.patient);
                    socket.on("newAppointmentPatientData",function(results){

                        for(var n = 0; n < results.length ;n ++) {
                            vm.inventory.push({
                                time: data.new_val.time,
                                displayTime:data.new_val.displayTime,
                                id: data.new_val.id,
                                DOB: results[n].DOB,
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



