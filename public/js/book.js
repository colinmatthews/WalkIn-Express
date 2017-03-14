/**
 * Created by colin on 1/14/2017.
 */

//### Book.js
// ***
// Book.js contains all of the logic for the booking page. This includes vueJS frontend components
// and socket.IO calls. There is also various helper functions used throughout the code.



// *** Google Maps Initialization **
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
initMap();


//*** Variable Initialization ***
//Creates a new date object that only is formated as : mm/dd/yyyy
var today = new Date().toLocaleString([],{month:'2-digit',day:'2-digit',year:'numeric'});
var socket = io.connect();
socket.emit("getDateAppointments",today);


//*** Vue JS Components and Functions ***

//#### modal ####
// This is the modal that appears when a patient clicks on the 'Book' button, visible on any unbooked appointment
var modal = {
    props:['item','showModal'],
    template: '#modal-template',
    methods:{

        //  ***bookAppointment***
        //
        //  **What:**
        //   Sends a request to the server to create a new patient based on the input information, and assigns that patient to this appointment
        //
        //  **Why:**
        //  To facilitate booking appointments
        //
        //**When:**
        //  After a patient clicks "Book"
        //

        bookAppointment:function(appointmentID){
            console.log("here");
            var data={
                "DOB":  document.getElementById("dobInput").value ,
                "address":  document.getElementById("addressInput").value,
                "doctor_id": "12345",
                "name":  document.getElementById("nameInput").value ,
                "phone":  document.getElementById("phoneInput").value
            };
            socket.emit("createPatient",data);
            socket.on("newPatientID",function (patientID) {
                console.log(patientID);
                socket.emit("assignAppointment",patientID,appointmentID);
            });
        },
        //  ***enableSubmit ***
        //
        //  **What:**
        //   Allows the booking form to be submitted after the user agrees to the privacy
        //
        //  **Why:**
        //  To ensure users agree to the privacy policy
        //
        //  **When:**
        //  After the booking modal is open
        //

        enableSubmit:function () {
            console.log("enableSubmit");
            if(document.getElementById("submitCheck").checked == true){
                document.getElementById("submit").disabled = false;
            }
            else{
                document.getElementById("submit").disabled = true;
            }

        }
    }
};

//#### appointment ####
// Component that wraps around the modal-template

Vue.component('appointment',{
    props:['item','showModal'],
    template:'#appointment',
    components:{
      'modal':modal
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
        ],
        showModal: false
    },
    created: function () {
        // var tempArray is used to store and sort by time the appointments before they are pushed to the front-end local array.
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
            // tempArray.sort sorts the array by time
            tempArray.sort(function(a, b){
                return a.time > b.time
            });
            // This for loop pushes the now sorted array into the local vueJS array, where they will appear on the front end
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

