/**
 * Created by colin on 11/8/2016.
 */
var socket = io.connect();
socket.emit("getInitialAppointments");
// Triggers event in app.js to get initial data from the database.

Vue.component('appointment',{
    props:['item'],
    template:'#appointment',
    methods:{
        deleteAppointment:function(data){
            console.log(data);
            socket.emit("deleteAppointment",data);
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
                vm.inventory.push({
                    time:data[i].time,
                    id:data[i].id,
                    patient:data[i].patient
                });
            }
            socket.emit('updateRecords');
        });

        socket.on('updateRecordsResults',function(data){
            if(data.old_val == null){
                if(data.new_val.patient!=null) {
                    vm.inventory.push({
                        time: data.new_val.time,
                        id: data.new_val.id,
                        patient:data.new_val.patient});
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
        });

        }
});



// triggers when the page is created
