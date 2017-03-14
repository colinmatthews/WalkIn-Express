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
            if(document.getElementById("submitCheck").checked){
                document.getElementById("submit").disabled = false;
            }
            else{
                document.getElementById("submit").disabled = true;
            }

        },

        //  ***validateForm ***
        //
        //  **What:**
        //   Validates the user's input into the form on the client side, and if valid books the appointment
        //
        //  **Why:**
        //  To ensure input is as clean as possible
        //
        //  **When:**
        //  When the user clicks "Book!"
        //

        validateForm:function(appointmentID){

            var valid = true;
            var DOB = document.getElementById("dobInput").value;
            var address =  document.getElementById("addressInput").value;
            var name =  document.getElementById("nameInput").value ;
            var phone =  document.getElementById("phoneInput").value;

            var valiDate = moment(DOB);
            if (!valiDate.isValid()) {
                valid = false;

                document.getElementById("DOB-alert").className =
                    document.getElementById("DOB-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )

            }
            if( name == ""){
                valid = false;
                document.getElementById("name-alert").className =
                    document.getElementById("name-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if(!phone.match(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/))
            {
                valid = false;
                document.getElementById("phone-alert").className =
                    document.getElementById("phone-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if( address == ""){
                valid = false;
                document.getElementById("address-alert").className =
                    document.getElementById("address-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if(valid){
                var data={
                    "DOB":  document.getElementById("dobInput").value ,
                    "address":  document.getElementById("addressInput").value,
                    "doctor_id": "12345",
                    "name":  document.getElementById("nameInput").value ,
                    "phone":  document.getElementById("phoneInput").value
                };
                socket.emit("checkAvailability", appointmentID);

                socket.on("checkAvailabilityResults",function(result){
                    console.log(result);
                    if(result== null) {
                        socket.emit("createPatient", data);
                        socket.on("newPatientID", function (patientID) {
                            console.log(patientID);
                            socket.emit("assignAppointment", patientID, appointmentID);
                        });
                        // // redirect to success page
                    }
                    else{
                        // notify user someone else has already booked that appointment
                    }
                });

            }

        },

        //  ***hideElement ***
        //
        //  **What:**
        //   adds the "hide" class to any element passed into it, which hides it from the front end
        //
        //  **Why:**
        //  To remove error messages
        //
        //  **When:**
        //  When the user dismisses an error message
        //

        hideElement:function (elementName) {
            document.getElementById(elementName).className += " hide";
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

