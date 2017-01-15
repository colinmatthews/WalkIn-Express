/**
 * Created by colin on 1/14/2017.
 */


function initMap() {
    var uluru = {lat:42.296113, lng:-83.047560};
    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 13,
        center: uluru
    });
    var marker = new google.maps.Marker({
        position: uluru,
        map: map
    });
}



// Triggers event in app.js to get initial data from the database.
var socket = io.connect();
socket.emit("getInitialAppointments");

Vue.component('appointment',{
    props:['item'],
    template:'#appointment',
    methods:{
        bookAppointment:function(appointmentID){

            var data={
                "DOB":  document.getElementById("dobInput").value ,
                "address":  document.getElementById("addressInput").value,
                "doctor_id": "4758038d-fc7f-4c7c-81ef-bce8cda709f0",
                "healthcard":  document.getElementById("hcInput").value ,
                "name":  document.getElementById("nameInput").value ,
                "phone":  document.getElementById("phoneInput").value
            }



            socket.emit("createPatient",data);
            socket.on("newPatientID",function (patientID) {
                console.log(patientID);
                socket.emit("assignAppointment",patientID,appointmentID);
            });
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
    created: function () {

        socket.on("initRecordsAppointments",function(data){
            for (var i = 0; i < data.length; i++) {
                if(data[i].patient == null) {
                    vm.inventory.push({
                        time: data[i].time,
                        id: data[i].id,
                        patient: data[i].patient,
                        displayTime: data[i].displayTime
                    });
                }
            }
            socket.emit('updateRecords');
        });

        socket.on('updateRecordsResults',function(data){
            if(data.old_val == null){
                vm.inventory.push({
                    time: data.new_val.time,
                    id: data.new_val.id,
                    patient:data.new_val.patient,
                    displayTime:data.new_val.displayTime});

            }

            // if an existing appointment is deleted
            else if(data.new_val == null) {
                for (var i = 0; i < vm.inventory.length; i ++) {
                    if (vm.inventory[i].id == data.old_val.id) {
                        vm.inventory.splice(i,1);
                    }
                }
            }
        });

    }
});
