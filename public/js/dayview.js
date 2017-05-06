/**
 * Created by colin on 11/15/2016.
 */

var today = moment(new Date()).format('YYYYMMDD');

var socket = io.connect();
socket.emit("getDateAppointments",today);

Vue.component('schedule',{
    props:['item'],
    template:'#schedule'
});

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
                        patient:data[i].patient,
                        displayTime:data[i].displayTime
                    });
                if(data[i].patient!=null) {
                    socket.emit("getNewAppointmentPatient", data[i].patient);
                    socket.on("newAppointmentPatientData", function (results) {
                        for (var n = 0; n < results.length; n++) {
                            vm.inventory.splice(n,0,{
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

            for(var j=0;j<vm.inventory.length;j++){
                console.log(vm.inventory[j]);
            }

            socket.emit('updateRecordsDashboard');
        });

        socket.on('updateRecordsResultsDashboard',function(data){
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
