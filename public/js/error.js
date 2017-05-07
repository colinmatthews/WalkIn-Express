/**
 * Created by colin on 5/7/2017.
 */
var socket = io.connect();

var error = localStorage.getItem("error");
var message = localStorage.getItem("message");
localStorage.clear();
var app = new Vue({
    el: '#app',
    data: {
        message: message,
        error: error
    }
});
