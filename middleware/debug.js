/**
 * Created by C on 2017-06-09.
 */
module.exports = function(env){


    var DEBUG = {};
    var state = env === 'development';

    if (state){
        DEBUG.appointments_table = 'appointments_staging';
        DEBUG.patients_table = 'patients_staging';
        DEBUG.domain = "localhost:8000";
    }
    else {
        DEBUG.appointments_table = 'appointments';
        DEBUG.patients_table = 'patients';
        DEBUG.domain = 'https://www.walkinexpress.ca';
    }

    return DEBUG;

};
