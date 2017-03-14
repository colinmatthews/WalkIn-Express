/**
 * Created by colin on 11/8/2016.
 */
//### Set.js
// ***
// Set.js contains all of the logic for the schedule page. This includes vueJS frontend components
// and socket.IO calls. There is also various helper functions used throughout the code.

//*** Variable Initialization ***
//Creates a new date object that only is formated as : mm/dd/yyyy
var today = new Date().toLocaleString([],{month:'2-digit',day:'2-digit',year:'numeric'});

var socket = io.connect();
socket.emit("getBookedAppointments", today);

//*** Vue JS Components and Functions ***

//#### confirm modal ####
// This is the modal that appears when someone attempts to delete a booked appointment

var confirmmodal = {
    props: ['item', 'showModal2'],
    template: '#confirmmodal-template',
    methods: {
        deleteAppointment: function (data) {
            console.log(data);
            socket.emit("deleteAppointment", data);
        }
    }
};

//#### patient confirm ####
// This is the modal that appears when someone views the patient information on a booked appointment
var patientmodal = {
    props: ['item', 'showModal'],
    template: '#patientmodal-template',

};

//#### appointment ####
// This is the modal that appears when an appointment is rendered
Vue.component('appointment',{
    props:['item','showModal','showModal2'],
    template:'#appointment',
    methods:{
        deleteAppointment:function(data){
            console.log(data);
            socket.emit("deleteAppointment",data);
        }
    },
    components:{
        'patientmodal':patientmodal,
        'confirmmodal':confirmmodal
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
        showModal:false,
        showModal2:false
    },
    methods:{
        deleteLocalContent:function(){
           vm.inventory.splice(0,vm.inventory.length);
        }

    },
    created: function () {
        // var tempArray is used to store and sort by time the appointments before they are pushed to the front-end local array.
        // var index is used to keep track of how many appointments have been added to the temp array
        var tempArray = [];
        var index =0;

        socket.on("initBookedAppointmentsSet", function (results, date) {
           for(var e = 0;e<results.length; e++ ) {
               //vm.inventory
                tempArray.push({


                   time: results[e].time,
                   id: results[e].id,
                   displayTime: results[e].displayTime,
                   patient: results[e].patient,
                   DOB: results[e].DOB,
                   phone: results[e].phone,
                   address: results[e].address,
                   name: results[e].name
               });
               index ++;
               // index++ keeps track of how many appointments have already been added to the array, so that when we
               // add the unbooked appointments, they dont override the existing entries in the array.
           }
            socket.emit("getUnbookedAppointments",date);
        });


        socket.on("initUnbookedAppointmentsSet",function(data, date){
            console.log(data.length);
            console.log(index);

            for (var i = index; i < (data.length)+ index; i++) {
                console.log(data.length);
                tempArray.push({
                    time: data[i-index].time,
                    id: data[i-index].id,
                    patient: data[i-index].patient,
                    displayTime: data[i-index].displayTime

                });
            }
            // tempArray.sort sorts the array by time
            tempArray.sort(function(a, b){
                return a.time > b.time
            });

            for( var j=0; j < tempArray.length;j++){
                vm.inventory.push (tempArray[j]);
            }

            socket.emit('updateRecordsSet',date);
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

//#### modal ####
// This modal appears when you click " Add new appointment"
Vue.component('modal', {
    template: '#modal-template',
    methods:{
        newAppointmentSlot:function(){
            var hour = parseInt(document.getElementById('hourInput').value);
            var minute = parseInt(document.getElementById('minInput').value);
            var period = document.getElementById('period').value;
            var date = document.getElementById('datepicker').value;
            if(period == "PM" && hour != 12){

                hour = hour + 12.0;
            }
            if(period == "AM" && hour == 12 ){
                hour = hour +12.0;
            }

            console.log(date);
            socket.emit("newAppointmentSlot",hour,minute,date,period);
        }
    }
});

//#### modal ####
// A second instance of vue-js that is used for the appointment modal
var modalvm = new Vue({
    el: '#app',
    data: {
        showModal: false
    }
});


// Changes the current date, called by 'Change Date button
function changeDate(){
    socket.emit("closeCursor");
    var date = document.getElementById('datepicker').value;
    document.getElementById("currentDate").innerHTML = new Date(date).toDateString();
    console.log(date);
    vm.deleteLocalContent();
    socket.emit('getBookedAppointments',date);
}

// creates the date picker from jquery-ui and populates with today's date
$( function() {
    $( "#datepicker" ).datepicker();
    $("#datepicker").datepicker('setDate', new Date());

} (jQuery));



// triggers when the page is created
