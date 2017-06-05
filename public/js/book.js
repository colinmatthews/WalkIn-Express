/**
 * Created by colin on 1/14/2017.
 */

//### Book.js
// ***
// Book.js contains all of the logic for the booking page. This includes vueJS frontend components
// and socket.IO calls. There is also various helper functions used throughout the code.






    //*** Variable Initialization ***
    //Creates a new date object that only is formated as : mm/dd/yyyy


var today = moment(new Date()).format('YYYYMMDD');
console.log(today);
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
            if(document.getElementById("privacyCheck").checked && document.getElementById("emailCheck").checked){
                document.getElementById("submit").disabled = false;
            }
            else{
                document.getElementById("submit").disabled = true;
            }

        },

        //  ***validateForm ***
        //
        //  **What:**
        //   Validates the user's input into the form on the client side, validates email with neverbounce, books if valid
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
            var fname =  document.getElementById("fNameInput").value ;
            var lname =  document.getElementById("lNameInput").value ;
            var phone =  document.getElementById("phoneInput").value;
            var email = document.getElementById("emailInput").value;


            var valiDate = moment(DOB);

            if (!valiDate.isValid()) {
                valid = false;

                document.getElementById("DOB-alert").className =
                    document.getElementById("DOB-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )

            }
            if( fname === ""){
                valid = false;
                document.getElementById("fname-alert").className =
                    document.getElementById("fname-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }
            if( lname === ""){
                valid = false;
                document.getElementById("lname-alert").className =
                    document.getElementById("lname-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if(!phone.match(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/))
            {
                valid = false;
                document.getElementById("phone-alert").className =
                    document.getElementById("phone-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if( address === ""){
                valid = false;
                document.getElementById("address-alert").className =
                    document.getElementById("address-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if(!email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/)){
                valid = false;
                document.getElementById("email-alert").className =
                    document.getElementById("email-alert").className.replace
                    ( /(?:^|\s)hide(?!\S)/g , '' )
            }

            if(valid){
                var minor = false;
                if(moment().diff(valiDate,"years")<18){
                    if(confirm("You are under 18. Do you have parental consent to book this appointment?")===false){
                        minor = true;
                    }
                }

                if(!minor) {
                    socket.emit('validateEmail', email);

                    socket.on('validEmail', function () {

                        var data = {
                            "DOB": DOB,
                            "doctor_id": "123ABC",
                            "address": address,
                            "name": fname,
                            "phone": phone,
                            "email": email
                        };

                        socket.emit("checkAvailability", appointmentID);

                        socket.on("checkAvailabilityResults", function (result) {
                            console.log(result);
                            if (result === null) { // result returns the appointments patient field ( will be null when there is no patient)
                                socket.emit("createPatient", data);
                                socket.on("newPatientID", function (patientID) {
                                    console.log(patientID);
                                    socket.emit("assignAppointment", patientID, appointmentID);
                                    window.location.replace("/success");
                                });

                            }
                            else {
                                localStorage.setItem("error", 'That appointment has already been booked!');
                                window.location.replace("../error");
                            }

                        });

                    });
                }

                socket.on('invalidEmail', function () {

                    valid = false;
                    document.getElementById("invalidEmail-alert").className =
                        document.getElementById("invalidEmail-alert").className.replace
                        ( /(?:^|\s)hide(?!\S)/g , '' )

                });
            }
        },

        //  ***hideElement ***
        //
        //  **What:**
        //   adds the "hide" class to any element passed into it, which hides it from the front end via bootstrap
        //
        //  **Why:**
        //  To remove error messages after they appear
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
//, as well as one large function (created). This function is called when the page is created, and moves through a series of function calls
// between the client and the server in a sequential manner to populate appointments on the page.
var vm = new Vue({
    el: '#vue-instance',
    data: {
        inventory: [
        ],
        showModal: false
    },
    mounted: function () {

        socket.on("errorRedirect",function(message,err){
            localStorage.setItem("error", err);
            localStorage.setItem("message", message);
            window.location.replace("../error");


        });


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
            else if(data.new_val == null || data.new_val.patient != null) {
                for (var i = 0; i < vm.inventory.length; i ++) {
                    if (vm.inventory[i].id == data.old_val.id) {
                        vm.inventory.splice(i,1);
                    }
                }
            }
        });

    }
});

