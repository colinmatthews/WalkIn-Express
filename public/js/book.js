/**
 * Created by colin on 1/14/2017.
 */


var today = new Date().toLocaleString([],{month:'2-digit',day:'2-digit',year:'numeric'});

// Triggers event in app.js to get initial data from the database.
var socket = io.connect();
socket.emit("getDateAppointments",today);

var modal = {
    props:['item','showModal'],
    template: '#modal-template',
    methods:{
        bookAppointment:function(appointmentID){
            console.log("here");
            var data={
                "DOB":  document.getElementById("dobInput").value ,
                "address":  document.getElementById("addressInput").value,
                "doctor_id": "4758038d-fc7f-4c7c-81ef-bce8cda709f0",
                "name":  document.getElementById("nameInput").value ,
                "phone":  document.getElementById("phoneInput").value
            };
            socket.emit("createPatient",data);
            socket.on("newPatientID",function (patientID) {
                console.log(patientID);
                socket.emit("assignAppointment",patientID,appointmentID);
            });
        }
    }
};

Vue.component('appointment',{
    props:['item','showModal'],
    template:'#appointment',
    components:{
      'modal':modal
    }
});
// Component that appears when a new appointment is made/updated with a patient


var vm = new Vue({
    el: '#vue-instance',
    data: {
        inventory: [
        ],
        showModal: false
    },
    created: function () {

        var tempArray = [];

        socket.on("initRecordsAppointments",function(data){
            for (var i = 0; i < data.length; i++) {
                if(data[i].patient == null) {
                    tempArray.push({
                        time: data[i].time,
                        id: data[i].id,
                        patient: data[i].patient,
                        displayTime: data[i].displayTime
                    });
                }
            }

            tempArray.sort(function(a, b){
                return a.time > b.time
            });

            for( var j=0; j < tempArray.length;j++){
                vm.inventory.push (tempArray[j]);
            }

            socket.emit('updateRecordsSet',today);
        });

        socket.on('updateRecordsResultsSet',function(data){
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