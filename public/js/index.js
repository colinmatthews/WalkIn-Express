/**
 * Created by colin on 1/11/2017.
 */
(function ($) {
    $(document).ready(function(){

        // hide .navbar first
        $(".navbar").hide();

        // fade in .navbar
        $(function () {
            $(window).scroll(function () {

                // set distance user needs to scroll before we start fadeIn
                if ($(this).scrollTop() > 100) {
                    $('.navbar').fadeIn();
                } else {
                    $('.navbar').fadeOut();
                }
            });
        });

    });
}(jQuery));