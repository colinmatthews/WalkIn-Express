/**
 * Created by colin on 11/8/2016.
 */
// initialize dates
document.getElementById("currentDate").innerHTML = new Date().toDateString();
var today = new Date().toLocaleString([],{month:'2-digit',day:'2-digit',year:'numeric'});

// connect to app.js, get today's appointments
var socket = io.connect();
socket.emit("getDateAppointments",today);


var patientmodal = {
    props: ['item', 'showModal'],
    template: '#patientmodal-template'
};

// Component that appears when a new appointment is made/updated with a patient
Vue.component('appointment',{
    props:['item','showModal'],
    template:'#appointment',
    methods:{
        deleteAppointment:function(data){
            console.log(data);
            socket.emit("deleteAppointment",data);
        }
    },
    components:{
        'patientmodal':patientmodal
    }
});

var vm = new Vue({
    el: '#vue-instance',
    data: {
        inventory: [
        ],
        showModal:false
    },
    methods:{
        deleteLocalContent:function(){
           vm.inventory.splice(0,vm.inventory.length);
        }

    },
    created: function () {

        socket.on("initRecordsAppointments",function(data){
            for (var i = 0; i < data.length; i++) {
                vm.inventory.push({
                    time:data[i].time,
                    id:data[i].id,
                    patient:data[i].patient,
                    displayTime:data[i].displayTime
                });

            }
            var date = document.getElementById('datepicker').value;
            console.log("init " +date);
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

// modal for adding appointments
Vue.component('modal', {
    template: '#modal-template',
    methods:{
        newAppointmentSlot:function(){
            var time = parseInt(document.getElementById('timeInput').value);
            var zone = document.getElementById('sel1').value;
            var date = document.getElementById('datepicker').value;
            if(zone == "PM" && time != 12){

                time = time + 12;
            }
            if(zone == "AM" && time == 12 ){
                time=time +12;
            }
            console.log(date);
            socket.emit("newAppointmentSlot",time,date);
        }
    }
});


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
    socket.emit('getDateAppointments',date);
}
// creates the date picker from jquery-ui and populates with today's date
$( function() {
    $( "#datepicker" ).datepicker();
    $("#datepicker").datepicker('setDate', new Date());

} (jQuery));



// triggers when the page is created
